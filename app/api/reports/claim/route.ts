import { NextRequest, NextResponse } from 'next/server'

import { deedEmail, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CASE_RE = /^[A-Za-z0-9 ()._/-]{3,120}$/
const COUNTY_RE = /^[A-Za-z .'-]{3,40}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ClaimResult = {
  ok?: boolean
  reason?: string
  claim_id?: string
  status?: string
  report_pdf_url?: string | null
  tier_id?: string
  allowance?: number
  used?: number
  remaining?: number
  period_start?: string
}

/**
 * POST /api/reports/claim — spend one of this month's SIGNAL$ Property
 * Reports (PROMISE-4, issue 20518).
 *
 * This is the subscription counterpart to /buy-report's $25 one-time
 * checkout. A subscriber paying for an allowance must be able to take a report
 * without paying again; before this route existed there was no such path in
 * the product at all, on any tier.
 *
 * All of the accounting lives in claim_signal_report(): it holds a
 * transaction-scoped advisory lock per customer, counts the calendar month in
 * America/New_York, returns the existing row for free when the same property
 * has already been claimed, and refuses past the tier's allowance. This route
 * validates input, calls it once, and maps the reason onto a status code. It
 * deliberately holds no copy of the allowance numbers — the tier table is the
 * only place those live.
 *
 * 401 signed out · 400 bad input · 402 out of allowance or a tier with none ·
 * 200 claimed or already claimed.
 */
export async function POST(req: NextRequest) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { supabase } = auth.ctx

  const email = await deedEmail()
  if (!email) {
    return NextResponse.json({ error: 'This account has no email address to match a subscription against.' }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as { county?: unknown; case_number?: unknown; mca_id?: unknown } | null
  const county = typeof body?.county === 'string' ? body.county.trim() : ''
  const caseNumber = typeof body?.case_number === 'string' ? body.case_number.trim() : ''
  const mcaId = typeof body?.mca_id === 'string' && UUID_RE.test(body.mca_id) ? body.mca_id : null

  if (!COUNTY_RE.test(county) || !CASE_RE.test(caseNumber)) {
    return NextResponse.json({ error: 'A county and case number are required.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('claim_signal_report', {
    p_email: email,
    p_county: county,
    p_case_number: caseNumber,
    p_mca_id: mcaId,
  })
  if (error) {
    return NextResponse.json({ error: 'Could not claim a report right now.' }, { status: 502 })
  }

  const result = (data ?? {}) as ClaimResult
  if (result.ok) {
    return NextResponse.json({
      claim_id: result.claim_id ?? null,
      status: result.status ?? 'pending',
      already_claimed: result.reason === 'already_claimed',
      report_pdf_url: result.report_pdf_url ?? null,
      tier_id: result.tier_id ?? 'free',
      allowance: result.allowance ?? 0,
      used: result.used ?? 0,
      remaining: result.remaining ?? 0,
      period_start: result.period_start ?? null,
    })
  }

  // Everything below is "you cannot have one", not "something broke". 402 is
  // the same code the D4D and heatmap gates use for an entitlement refusal, so
  // the client has one branch for all of them.
  const message =
    result.reason === 'allowance_exhausted'
      ? 'You have used every SIGNAL$ Property Report in your plan this month.'
      : result.reason === 'tier_has_no_allowance'
        ? 'Your plan does not include SIGNAL$ Property Reports.'
        : result.reason === 'no_customer'
          ? 'No subscription is on file for this account yet.'
          : 'A county and case number are required.'

  const status = result.reason === 'missing_arguments' ? 400 : 402
  return NextResponse.json(
    {
      error: message,
      reason: result.reason ?? 'unknown',
      tier_id: result.tier_id ?? 'free',
      allowance: result.allowance ?? 0,
      used: result.used ?? 0,
      remaining: result.remaining ?? 0,
      buy_url: `/buy-report?county=${encodeURIComponent(county)}&case=${encodeURIComponent(caseNumber)}`,
    },
    { status }
  )
}
