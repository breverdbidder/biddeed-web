import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PIONEER, getStripe, pioneerPriceId } from '@/lib/stripe'
import { publicOrigin } from '@/lib/public-origin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

function siteOrigin(req: NextRequest): string {
  // Fallback is the PUBLIC origin, not req.nextUrl.origin: behind the router
  // that is the internal workers.dev host, and Stripe would send the buyer
  // back there (same defect as the share links, biddeed-web PR 143).
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    publicOrigin(req)
  ).replace(/\/$/, '')
}

/**
 * POST /api/pioneers/checkout
 * $990/yr recurring → Pro tier, rate locked while subscribed.
 * Never reuse Investor annual price ID.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_PIONEER_PRO_ANNUAL) {
      return NextResponse.json(
        { error: 'Pioneer checkout is not configured yet (missing Stripe env).' },
        { status: 503 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const clerkUserId = typeof body.clerk_user_id === 'string' ? body.clerk_user_id : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    const supabase = admin()
    const { data: seats, error: seatsErr } = await supabase
      .from('pioneer_seats')
      .select('sold, cap')
      .eq('id', true)
      .maybeSingle()

    if (seatsErr) {
      console.error(seatsErr)
      return NextResponse.json({ error: 'Could not check seat availability' }, { status: 503 })
    }

    const sold = seats?.sold ?? 0
    const cap = seats?.cap ?? PIONEER.cap
    if (sold >= cap) {
      return NextResponse.json({ error: 'Sold out — all 100 Pioneer seats are taken.' }, { status: 409 })
    }

    const stripe = getStripe()
    const priceId = pioneerPriceId()
    const origin = siteOrigin(req)

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pioneers/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pioneers?canceled=1`,
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      metadata: {
        campaign: PIONEER.campaign,
        tier_id: PIONEER.tierId,
        rate_lock_cents: String(PIONEER.lockedAnnualCents),
        product: 'pioneer_pro',
        clerk_user_id: clerkUserId,
        customer_email: email,
      },
      subscription_data: {
        metadata: {
          campaign: PIONEER.campaign,
          tier_id: PIONEER.tierId,
          rate_lock_cents: String(PIONEER.lockedAnnualCents),
          product: 'pioneer_pro',
          clerk_user_id: clerkUserId,
          customer_email: email,
        },
      },
      custom_text: {
        submit: {
          message:
            'You are joining 100 Pioneers: $990/year for Pro access. Your $990/yr Pro rate stays locked for as long as you keep renewing. Cancel and the lock ends. No Pro Plus. No direct founder line.',
        },
      },
    })

    if (!checkout.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 })
    }

    return NextResponse.json({
      url: checkout.url,
      sessionId: checkout.id,
      remaining: Math.max(cap - sold, 0),
    })
  } catch (e) {
    console.error('pioneers checkout failed', e)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
