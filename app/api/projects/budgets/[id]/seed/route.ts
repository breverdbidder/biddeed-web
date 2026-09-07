import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import { callerOwnsBudget } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TEMPLATES = new Set(['cosmetic', 'standard', 'gut'])

// POST /api/projects/budgets/[id]/seed — seed a budget from a template.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const check = await requireCapability('build_rehab_budget')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Rehab budget building requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const id = (await context.params).id
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid budget identifier.' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const template = typeof body.template === 'string' && TEMPLATES.has(body.template) ? body.template : 'standard'
  const sqft = typeof body.sqft === 'number' && Number.isFinite(body.sqft) ? body.sqft : null

  const supabase = getRetryingSupabaseClient()
  if (!(await callerOwnsBudget(supabase, id, check.email))) {
    return NextResponse.json({ error: 'Budget not found.' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('cm_budget_seed_template', { p_budget_id: id, p_template: template, p_sqft: sqft })
  if (error) return NextResponse.json({ error: 'Unable to seed this budget.' }, { status: 502 })
  return NextResponse.json(data)
}
