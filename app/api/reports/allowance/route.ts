import { NextResponse } from 'next/server'

import { deedEmail, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/reports/allowance — how many SIGNAL$ Property Reports this
 * subscriber has left this month (PROMISE-2 / PROMISE-4, issue 20518).
 *
 * The pricing page prints an allowance on three tiers: 10 a month on Investor,
 * 30 on Pro, 50 on Pro Plus. Until now nothing in this app could answer "how
 * many have I used" — a report only ever unlocked against a $25 one-time
 * purchase (lib/deed/reports.ts), and /buy-report charged $25 with no tier
 * awareness, so a Pioneer paying $990/yr for thirty reports a month had no
 * way to take even one of them.
 *
 * signal_report_allowance() is the read-only half of the ledger and spends
 * nothing; claim_signal_report() (POST /api/reports/claim) is the only thing
 * that can spend a credit. Both are service-definer RPCs revoked from anon and
 * authenticated — the allowance is money-equivalent, so it is never computed
 * in the browser and never from a second copy of the tier table.
 */
export async function GET() {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { supabase } = auth.ctx

  const email = await deedEmail()
  if (!email) {
    // Signed in with no email on the Clerk profile: nothing to match a
    // customer row against. Same shape as a free account rather than an error,
    // because the caller renders this, it does not branch on it.
    return NextResponse.json({ tier_id: 'free', allowance: 0, used: 0, remaining: 0, period_start: null })
  }

  const { data, error } = await supabase.rpc('signal_report_allowance', { p_email: email })
  if (error) {
    return NextResponse.json({ error: 'Could not read your report allowance right now.' }, { status: 502 })
  }
  return NextResponse.json(data ?? { tier_id: 'free', allowance: 0, used: 0, remaining: 0, period_start: null })
}
