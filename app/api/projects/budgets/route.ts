import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NAME_MAX = 200

interface CreateBody {
  name: string
  projectId: string | null
  purchasePrice: number | null
  arv: number | null
  sqft: number | null
  contingencyPct: number | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseCreateBody(value: unknown): CreateBody | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > NAME_MAX) return null
  const projectId = typeof input.projectId === 'string' && UUID_RE.test(input.projectId) ? input.projectId : null
  return {
    name,
    projectId,
    purchasePrice: numOrNull(input.purchasePrice),
    arv: numOrNull(input.arv),
    sqft: numOrNull(input.sqft),
    contingencyPct: numOrNull(input.contingencyPct),
  }
}

// GET /api/projects/budgets — the signed-in user's rehab budgets.
export async function GET() {
  const check = await requireCapability('get_rehab_budget')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Rehab budgets require an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const supabase = getRetryingSupabaseClient()
  const { data, error } = await supabase.rpc('cm_budgets_list', { p_owner_email: check.email, p_limit: 50 })
  if (error) return NextResponse.json({ error: 'Unable to load budgets.' }, { status: 502 })
  return NextResponse.json({ budgets: data ?? [] })
}

// POST /api/projects/budgets — create a rehab budget.
export async function POST(request: NextRequest) {
  const check = await requireCapability('build_rehab_budget')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Rehab budget building requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const body = parseCreateBody(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Invalid budget request.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()
  const { data, error } = await supabase.rpc('cm_budget_create', {
    p_owner_email: check.email,
    p_name: body.name,
    p_project_id: body.projectId,
    p_purchase_price: body.purchasePrice,
    p_arv: body.arv,
    p_sqft: body.sqft,
    p_contingency_pct: body.contingencyPct ?? 10,
    p_clerk_user_id: check.userId,
  })
  if (error) return NextResponse.json({ error: 'Unable to create this budget.' }, { status: 502 })
  return NextResponse.json({ budgetId: data })
}
