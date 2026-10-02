import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { serverError } from '@/lib/api-errors'

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
  // confirm_checkout_session() has no mode/product check: for ANY paid session
  // it writes public.purchases and delivers the Clear to Bid files. That is the
  // wrong product for a subscription (investor / pro / proplus) or a report, so
  // the RPC runs ONLY for a session Stripe says is a plain one-time payment with
  // no subscription tier and no report mode. Anything else, or anything we
  // cannot classify, fails closed.
  let stripeSession: { mode?: string | null; metadata?: Record<string, string> | null; payment_status?: string | null }
  try {
    const { getStripe } = await import('@/lib/stripe')
    stripeSession = await getStripe().checkout.sessions.retrieve(sessionId)
  } catch (e) {
    return serverError('checkout.confirm.classify', e, 503)
  }
  const meta = stripeSession.metadata ?? {}

  if (stripeSession.mode === 'subscription' || meta.tier_id) {
    // Subscription access is granted only by the stripe-webhook function. Report
    // active only when the session row is completed AND the customer record
    // already carries the purchased tier.
    const { data: row, error: rowErr } = await supabase
      .from('stripe_checkout_sessions')
      .select('tier_id,status,customer_id')
      .eq('session_id', sessionId)
      .maybeSingle()
    if (rowErr) return serverError('checkout.confirm.session', rowErr, 503)
    const tier = String(row?.tier_id ?? meta.tier_id ?? '')
    let active = false
    if (row && row.status === 'completed' && row.customer_id && stripeSession.payment_status === 'paid') {
      const { data: cust, error: custErr } = await supabase
        .from('mcp_customers')
        .select('tier_id')
        .eq('customer_id', row.customer_id)
        .maybeSingle()
      if (custErr) return serverError('checkout.confirm.customer', custErr, 503)
      active = cust?.tier_id === tier
    }
    return NextResponse.json({
      status: active ? 'subscription_active' : 'subscription_pending',
      tier,
      delivery: null,
      email: null,
      error: null,
    })
  }

  if (stripeSession.mode !== 'payment' || meta.mode === 'report') {
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
