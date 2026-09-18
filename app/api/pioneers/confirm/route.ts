import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { fulfilPioneerCheckout } from '@/lib/pioneer-fulfilil'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/pioneers/confirm?session_id=cs_... — Stripe re-read, then fulfil. */
export async function POST(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get('session_id')
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: 'missing or malformed session_id' }, { status: 400 })
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ status: 'unpaid', payment_status: session.payment_status })
    }

    await fulfilPioneerCheckout(session)
    return NextResponse.json({ status: 'ok', tier: 'pro', campaign: '100_pioneers' })
  } catch (e) {
    console.error('pioneers confirm failed', e)
    return NextResponse.json({ error: 'confirm failed' }, { status: 500 })
  }
}
