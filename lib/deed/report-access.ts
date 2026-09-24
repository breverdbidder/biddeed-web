/**
 * SIGNAL-1: who may see the SIGNAL$ report values in a project (S3).
 *
 * A pure decision over rows the Projects route has already read, so the rule
 * can be tested without a database (scripts/validate-signal-report-access.mts).
 *
 * The values unlock only for a report this account actually has:
 *   - a one-time $25 purchase that was paid. The checkout writes a 'pending'
 *     report_delivery_queue row as soon as Stripe Checkout opens, before any
 *     payment, so a queue row alone proves nothing. Paid means the row is
 *     'delivered', or a `purchases` row exists for its Stripe session (written
 *     only once Stripe reports the session paid) and has not been revoked.
 *     On 24 Sep 2026 22 abandoned checkouts sat in the queue as 'pending' and
 *     every one of them unlocked the panel.
 *   - a subscriber claim (signal_report_claims) for this sale. A claim is
 *     written only after the plan allowance was debited, so any claim row is
 *     an entitlement; before this fix claims never unlocked the panel.
 * A revoked (refunded) purchase locks again, even if its PDF was delivered.
 */

export interface QueueRow {
  id: string
  status: string
  stripe_session_id: string | null
  report_pdf_url: string | null
  created_at: string
  delivered_at: string | null
}

export interface PurchaseRow {
  stripe_session_id: string | null
  revoked_at: string | null
}

export interface ClaimRow {
  id: string
  status: string
  report_pdf_url: string | null
  created_at: string
  delivered_at: string | null
}

export interface ReportAccessDecision {
  unlocked: boolean
  status: 'none' | 'pending' | 'delivered'
  source: 'purchase' | 'claim' | null
  purchased_at: string | null
  delivered_at: string | null
  report_url: string | null
}

export const NO_ACCESS: ReportAccessDecision = {
  unlocked: false,
  status: 'none',
  source: null,
  purchased_at: null,
  delivered_at: null,
  report_url: null,
}

/** Stripe session ids of the queue rows that still need a payment check. */
export function sessionsToCheck(queue: QueueRow[]): string[] {
  return [...new Set(queue.map((q) => q.stripe_session_id).filter((s): s is string => typeof s === 'string' && s.length > 0))]
}

interface Candidate {
  source: 'purchase' | 'claim'
  delivered: boolean
  created_at: string
  delivered_at: string | null
  report_pdf_url: string | null
}

export function decideReportAccess(queue: QueueRow[], purchases: PurchaseRow[], claims: ClaimRow[]): ReportAccessDecision {
  const paid = new Set<string>()
  const revoked = new Set<string>()
  for (const p of purchases) {
    if (!p.stripe_session_id) continue
    if (p.revoked_at) revoked.add(p.stripe_session_id)
    else paid.add(p.stripe_session_id)
  }

  const candidates: Candidate[] = []
  for (const q of queue) {
    const sid = q.stripe_session_id
    if (sid && revoked.has(sid)) continue
    const delivered = q.status === 'delivered'
    if (!delivered && !(sid && paid.has(sid))) continue
    candidates.push({ source: 'purchase', delivered, created_at: q.created_at, delivered_at: q.delivered_at, report_pdf_url: q.report_pdf_url })
  }
  for (const c of claims) {
    candidates.push({ source: 'claim', delivered: c.status === 'delivered', created_at: c.created_at, delivered_at: c.delivered_at, report_pdf_url: c.report_pdf_url })
  }
  if (candidates.length === 0) return NO_ACCESS

  // A delivered report beats one still being prepared; then the newest.
  candidates.sort((a, b) => Number(b.delivered) - Number(a.delivered) || b.created_at.localeCompare(a.created_at))
  const best = candidates[0]
  return {
    unlocked: true,
    status: best.delivered ? 'delivered' : 'pending',
    source: best.source,
    purchased_at: best.created_at,
    delivered_at: best.delivered_at,
    report_url: best.delivered && best.report_pdf_url ? best.report_pdf_url : null,
  }
}
