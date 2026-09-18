import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  if (!_stripe) {
    _stripe = new Stripe(key, {
      // stripe@17.7.0 is generated for this version; '2024-06-20' fails typecheck
      // (TS2322) and broke the production build after #144 (2026-09-18).
      apiVersion: '2025-02-24.acacia',
      typescript: true,
      // This app runs on Cloudflare Workers (OpenNext). stripe-node's default
      // transport is Node's https module, which never completes there: live
      // POST /api/pioneers/checkout hung past 40 s on both biddeed.ai and the
      // workers.dev origin (2026-09-18 06:2x EDT) while the Supabase-only
      // availability route answered instantly. Stripe's documented Workers
      // setup is the fetch-based client.
      httpClient: Stripe.createFetchHttpClient(),
    })
  }
  return _stripe
}

/** Dedicated Pioneer Pro annual price — NEVER reuse Investor annual price ID. */
export function pioneerPriceId(): string {
  const id = process.env.STRIPE_PRICE_PIONEER_PRO_ANNUAL
  if (!id) throw new Error('STRIPE_PRICE_PIONEER_PRO_ANNUAL is not configured')
  return id
}

export const PIONEER = {
  campaign: '100_pioneers',
  tierId: 'pro',
  lockedAnnualCents: 99_000,
  cap: 100,
  productName: 'BidDeed 100 Pioneers — Pro (rate-locked)',
} as const
