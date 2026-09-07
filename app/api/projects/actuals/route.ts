import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import { callerOwnsBudget } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MEMO_MAX = 500

interface ActualBody {
  budgetId: string
  amount: number
  vendor: string | null
  budgetLineId: string | null
  memo: string | null
  paidOn: string | null
  receiptUrl: string | null
}

function parseActualBody(value: unknown): ActualBody | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const budgetId = typeof input.budgetId === 'string' && UUID_RE.test(input.budgetId) ? input.budgetId : null
  const amount = typeof input.amount === 'number' && Number.isFinite(input.amount) ? input.amount : null
  if (!budgetId || amount === null) return null
  const vendor = typeof input.vendor === 'string' && input.vendor.trim() ? input.vendor.trim() : null
  const budgetLineId = typeof input.budgetLineId === 'string' && UUID_RE.test(input.budgetLineId) ? input.budgetLineId : null
  const memo = typeof input.memo === 'string' && input.memo.trim() ? input.memo.trim().slice(0, MEMO_MAX) : null
  const paidOn = typeof input.paidOn === 'string' && ISO_DATE.test(input.paidOn) ? input.paidOn : null
  const receiptUrl = typeof input.receiptUrl === 'string' && input.receiptUrl.trim() ? input.receiptUrl.trim() : null
  return { budgetId, amount, vendor, budgetLineId, memo, paidOn, receiptUrl }
}

// POST /api/projects/actuals — log a rehab spend against a budget (and optionally a line).
export async function POST(request: NextRequest) {
  const check = await requireCapability('log_rehab_actual')
  if (!check.allowed || !check.email) {
    return NextResponse.json(
      { error: 'Logging rehab actuals requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const body = parseActualBody(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Invalid actual spend request.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()
  if (!(await callerOwnsBudget(supabase, body.budgetId, check.email))) {
    return NextResponse.json({ error: 'Budget not found.' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('cm_actual_log', {
    p_budget_id: body.budgetId,
    p_amount: body.amount,
    p_vendor: body.vendor,
    p_budget_line_id: body.budgetLineId,
    p_memo: body.memo,
    p_paid_on: body.paidOn,
    p_receipt_url: body.receiptUrl,
  })
  if (error) return NextResponse.json({ error: 'Unable to log this spend.' }, { status: 502 })
  return NextResponse.json({ actualId: data })
}
