/**
 * Pure classification of a Stripe Checkout Session for the /success confirm
 * route. Kept free of Next/Stripe/Supabase imports so it can be tested alone.
 *
 * confirm_checkout_session() (DB) has no product check: for any paid session it
 * records public.purchases and delivers the Clear to Bid files. This module
 * decides which sessions may reach it. Anything unknown is refused.
 */
export type StripeSessionLike = {
  mode?: string | null
  payment_status?: string | null
  amount_total?: number | null
  currency?: string | null
  metadata?: Record<string, string> | null
}

/** The only one-time product this page fulfils: Clear to Bid, $25.00 USD.
 *  Grounded in public.purchases (amounts seen: 2500 x3, 99 x1). */
export const CLEAR_TO_BID_AMOUNT_CENTS = 2500

export type Classification =
  | { kind: 'subscription'; tier: string }
  | { kind: 'one_time' }
  | { kind: 'refuse'; reason: string }

export function classifyCheckoutSession(s: StripeSessionLike): Classification {
  const meta = s.metadata ?? {}
  if (s.mode === 'subscription' || meta.tier_id) {
    const tier = String(meta.tier_id ?? '')
    if (!tier) return { kind: 'refuse', reason: 'subscription session without tier' }
    return { kind: 'subscription', tier }
  }
  if (s.mode !== 'payment') return { kind: 'refuse', reason: 'unsupported mode' }
  if (meta.mode === 'report') return { kind: 'refuse', reason: 'report session' }
  if (String(s.currency ?? '').toLowerCase() !== 'usd' || s.amount_total !== CLEAR_TO_BID_AMOUNT_CENTS) {
    return { kind: 'refuse', reason: 'unrecognized product' }
  }
  return { kind: 'one_time' }
}

export type SubscriptionState = 'subscription_active' | 'subscription_pending'

/** Active only when Stripe says paid, the webhook marked the session
 *  completed, and the customer record already carries the purchased tier. */
export function subscriptionState(input: {
  paymentStatus?: string | null
  rowStatus?: string | null
  rowCustomerId?: string | null
  customerTier?: string | null
  tier: string
}): SubscriptionState {
  const ok =
    input.paymentStatus === 'paid' &&
    input.rowStatus === 'completed' &&
    !!input.rowCustomerId &&
    input.customerTier === input.tier
  return ok ? 'subscription_active' : 'subscription_pending'
}
