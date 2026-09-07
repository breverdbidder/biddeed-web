import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import { budgetIdForLine, callerOwnsBudget } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DESC_MAX = 300

interface UpsertBody {
  budgetId: string
  category: string
  description: string
  qty: number
  unit: string
  materialUnitCost: number
  laborUnitCost: number
  trade: string | null
  sortOrder: number | null
  lineId: string | null
  catalogItemId: string | null
}

function parseUpsertBody(value: unknown): UpsertBody | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const budgetId = typeof input.budgetId === 'string' && UUID_RE.test(input.budgetId) ? input.budgetId : null
  if (!budgetId) return null
  const category = typeof input.category === 'string' ? input.category.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (!category || !description || description.length > DESC_MAX) return null
  const qty = typeof input.qty === 'number' && Number.isFinite(input.qty) ? input.qty : 1
  const unit = typeof input.unit === 'string' && input.unit.trim() ? input.unit.trim() : 'ls'
  const materialUnitCost = typeof input.materialUnitCost === 'number' && Number.isFinite(input.materialUnitCost) ? input.materialUnitCost : 0
  const laborUnitCost = typeof input.laborUnitCost === 'number' && Number.isFinite(input.laborUnitCost) ? input.laborUnitCost : 0
  const trade = typeof input.trade === 'string' && input.trade.trim() ? input.trade.trim() : null
  const sortOrder = typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder) ? input.sortOrder : null
  const lineId = typeof input.lineId === 'string' && UUID_RE.test(input.lineId) ? input.lineId : null
  const catalogItemId = typeof input.catalogItemId === 'string' && UUID_RE.test(input.catalogItemId) ? input.catalogItemId : null
  return { budgetId, category, description, qty, unit, materialUnitCost, laborUnitCost, trade, sortOrder, lineId, catalogItemId }
}

// POST /api/projects/lines — add or edit a budget line. Pass lineId to edit, omit to insert.
export async function POST(request: NextRequest) {
  const check = await requireCapability('build_rehab_budget')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Rehab budget building requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const body = parseUpsertBody(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Invalid line request.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()
  if (!(await callerOwnsBudget(supabase, body.budgetId, check.email))) {
    return NextResponse.json({ error: 'Budget not found.' }, { status: 404 })
  }
  if (body.lineId) {
    const owningBudgetId = await budgetIdForLine(supabase, body.lineId)
    if (owningBudgetId !== body.budgetId) return NextResponse.json({ error: 'Line not found on this budget.' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('cm_line_upsert', {
    p_budget_id: body.budgetId,
    p_category: body.category,
    p_description: body.description,
    p_qty: body.qty,
    p_unit: body.unit,
    p_material_unit_cost: body.materialUnitCost,
    p_labor_unit_cost: body.laborUnitCost,
    p_trade: body.trade,
    p_sort_order: body.sortOrder,
    p_line_id: body.lineId,
    p_catalog_item_id: body.catalogItemId,
  })
  if (error) return NextResponse.json({ error: 'Unable to save this line.' }, { status: 502 })
  return NextResponse.json({ lineId: data })
}
