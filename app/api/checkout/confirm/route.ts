import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { serverError } from '@/lib/api-errors'
import { classifyCheckoutSession, subscriptionState, type StripeSessionLike } from '@/lib/checkout-classify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Instant fulfilment for the checkout success page.
 *
 * There is currently no Stripe webhook endpoint on the account -- the
 * restricted key lacks webhook_write -- so purchases are otherwise only picked
 * up by money_path_tick on a fifteen-minute cron. That is a fulfilment wait of up to
 * fifteen minutes. The success page knows the session id, so it asks Stripe
 * directly and fulfils on the spot.
 *
 * The route never trusts the session id as proof of payment. It hands it to
 * confirm_checkout_session(), which re-reads payment_status from Stripe before
 * writing anything. A forged or guessed id gets `unpaid` or an error, not a
 * product.
 *
 * Requires the service role key: confirm_checkout_session is revoked from anon
 * and authenticated precisely because session ids travel in URLs and would
 * otherwise be an email-enumeration surface.
 */
export async function POST(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('session_id')

  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json(
      { status: 'error', error: 'missing or malformed session_id' },
      { status: 400 }
    )
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    // Fail loudly rather than silently falling back to the anon key, which
    // cannot execute the function and would return a confusing 403.
    return NextResponse.json(
      { status: 'error', error: 'fulfilment is not configured' },
      { status: 500 }
    )
  }

  // confirm_checkout_session re-reads payment_status from Stripe before
  // writing anything, but we have no evidence it dedupes an already-
  // fulfilled session the way fulfil_stripe_purchase does — so this stays
  // on the default 'connect-only' retry mode (safe for a plain RPC POST):
  // retried only when we're sure the request never reached Postgres.
  const supabase = getRetryingSupabaseClient(serviceKey)

  // Classify the order from Stripe itself before any one-time fulfilment.
  // confirm_checkout_session() has no product check, so the RPC runs ONLY for a
  // session that classifyCheckoutSession() accepts as the Clear to Bid one-time
  // product. Subscriptions never reach it; unknown orders fail closed.
  let stripeSession: StripeSessionLike
  try {
    const { getStripe } = await import('@/lib/stripe')
    stripeSession = (await getStripe().checkout.sessions.retrieve(sessionId)) as StripeSessionLike
  } catch (e) {
    return serverError('checkout.confirm.classify', e as Error, 503)
  }
  const kind = classifyCheckoutSession(stripeSession)

  if (kind.kind === 'subscription') {
    // Access is granted only by the stripe-webhook function; report it active
    // only when that provisioning is visible on the customer record.
    const { data: row, error: rowErr } = await supabase
      .from('stripe_checkout_sessions')
      .select('tier_id,status,customer_id')
      .eq('session_id', sessionId)
      .maybeSingle()
    if (rowErr) return serverError('checkout.confirm.session', rowErr, 503)
    let customerTier: string | null = null
    if (row?.customer_id) {
      const { data: cust, error: custErr } = await supabase
        .from('mcp_customers')
        .select('tier_id')
        .eq('customer_id', row.customer_id)
        .maybeSingle()
      if (custErr) return serverError('checkout.confirm.customer', custErr, 503)
      customerTier = (cust?.tier_id as string | null) ?? null
    }
    return NextResponse.json({
      status: subscriptionState({
        paymentStatus: stripeSession.payment_status,
        rowStatus: row?.status as string | null | undefined,
        rowCustomerId: row?.customer_id as string | null | undefined,
        customerTier,
        tier: kind.tier,
      }),
      tier: kind.tier,
      delivery: null,
      email: null,
      error: null,
    })
  }

  if (kind.kind === 'refuse') {
    return NextResponse.json({
      status: 'error',
      delivery: null,
      email: null,
      error: 'order type is not handled by this page',
    })
  }

  const { data, error } = await supabase.rpc('confirm_checkout_session', {
    p_session_id: sessionId,
  })

  if (error) {
    // The buyer cannot act on an RPC's internal message, and this route sits on
    // the money path where upstream detail is most sensitive. Detail to logs.
    return serverError('checkout.confirm', error, 503)
  }

  const result = (data || {}) as Record<string, unknown>

  // Return the email so the page can tell the buyer where to look, but nothing
  // else about the purchase row.
  return NextResponse.json({
    status: result.status ?? 'error',
    delivery: result.delivery ?? null,
    email: result.email ?? null,
    error: result.error ?? null,
  })
}
