import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { PIONEER } from '@/lib/stripe'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

function isPioneer(meta: Stripe.Metadata | null | undefined): boolean {
  return meta?.campaign === PIONEER.campaign || meta?.product === 'pioneer_pro'
}

/**
 * Idempotent Pioneer fulfilment after paid Checkout:
 * claim seat, record pioneer_subscriptions, set mcp_customers.tier_id = pro.
 */
export async function fulfilPioneerCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== 'subscription') return
  if (!isPioneer(session.metadata)) return

  const email = (
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.customer_email ||
    ''
  ).toLowerCase()
  if (!email) {
    console.error('pioneer fulfil: missing email', session.id)
    return
  }

  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id
  if (!subId) {
    console.error('pioneer fulfil: missing subscription id', session.id)
    return
  }

  const priceId = process.env.STRIPE_PRICE_PIONEER_PRO_ANNUAL || ''
  const supabase = admin()

  const { data: existing } = await supabase
    .from('pioneer_subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subId)
    .maybeSingle()

  if (existing) {
    console.info('pioneer fulfil: already recorded', subId)
    return
  }

  const { data: claimed, error: claimErr } = await supabase.rpc('claim_pioneer_seat')
  if (claimErr) {
    console.error('claim_pioneer_seat failed', claimErr.message)
    throw claimErr
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id || null

  const { error: insErr } = await supabase.from('pioneer_subscriptions').insert({
    email,
    clerk_user_id: session.metadata?.clerk_user_id || null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subId,
    stripe_price_id: priceId,
    locked_annual_cents: PIONEER.lockedAnnualCents,
    tier_id: PIONEER.tierId,
    status: 'active',
  })

  if (insErr) {
    console.error('pioneer_subscriptions insert failed', insErr.message)
    if (claimed === true) await supabase.rpc('release_pioneer_seat')
    throw insErr
  }

  const { error: tierErr } = await supabase
    .from('mcp_customers')
    .update({ tier_id: PIONEER.tierId })
    .ilike('email', email)

  if (tierErr) {
    console.warn('mcp_customers tier update skipped/failed', tierErr.message)
  }
}
