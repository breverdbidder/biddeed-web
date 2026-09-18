import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  if (!_stripe) {
    _stripe = new Stripe(key, {
      apiVersion: '2024-06-20',
      typescript: true,
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
