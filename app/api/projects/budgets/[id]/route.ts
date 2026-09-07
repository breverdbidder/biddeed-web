import { NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import { callerOwnsBudget } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// GET /api/projects/budgets/[id] — full budget detail: lines, rollups, actuals, scopes.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const check = await requireCapability('get_rehab_budget')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Rehab budgets require an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const id = (await context.params).id
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid budget identifier.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()
  if (!(await callerOwnsBudget(supabase, id, check.email))) {
    return NextResponse.json({ error: 'Budget not found.' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('cm_budget_detail', { p_budget_id: id })
  if (error) return NextResponse.json({ error: 'Unable to load this budget.' }, { status: 502 })
  return NextResponse.json(data)
}
