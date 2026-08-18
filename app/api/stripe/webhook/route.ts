import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Node, not edge: signature verification needs the raw body and node:crypto.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Stripe webhook ingress - the money path.
 *
 * Two jobs, in this order, and the order is the whole design:
 *
 *   1. Verify the signature, then WRITE THE RAW EVENT to public.stripe_events.
 *   2. Only then attempt fulfilment.
 *
 * Fulfilment is allowed to fail. Persistence is not. Once the event is committed
 * the order can be fulfilled by the 15-minute cron, by a manual drain, or by
 * code not yet written - but an event that was never persisted is a customer who
 * paid and received nothing, and no downstream retry can recover it. So this
 * returns 200 as soon as the row is stored, even if fulfilment then throws: a
 * non-2xx would make Stripe redeliver an event we already hold safely, which
 * buys nothing and invites a retry storm. The single exception is a failed
 * insert, where we *want* redelivery.
 *
 * event_id is the primary key of stripe_events, so Stripe retries (up to ~3
 * days) collapse to one fulfilment. Without that, a single retry grants a second
 * set of AI credits.
 *
 * Signature checking uses node:crypto rather than the Stripe SDK. The scheme is
 * a documented HMAC-SHA256 over `${timestamp}.${rawBody}` and is ~20 lines;
 * pulling a large SDK into the one route standing between a payment and its
 * fulfilment adds supply-chain surface and a lockfile burden for no capability
 * needed here.
 */

const TOLERANCE_SECONDS = 300

function verifyStripeSignature(rawBody: string, header: string, secret: string): boolean {
  // Header form: t=1699999999,v1=abc...,v0=def...  (v0 is a legacy test scheme)
  const parts = header.split(',').reduce<Record<string, string[]>>((acc, kv) => {
    const [k, v] = kv.split('=')
    if (!k || !v) return acc
    ;(acc[k] ||= []).push(v)
    return acc
  }, {})

  const timestamp = parts['t']?.[0]
  const signatures = parts['v1'] || []
  if (!timestamp || signatures.length === 0) return false

  // Reject replays of an old, legitimately-signed body.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex')
  const expectedBuf = Buffer.from(expected, 'utf8')

  // Compare against every v1 present (Stripe sends more than one while a
  // signing secret is being rotated), and always in constant time.
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'utf8')
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
  })
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials are not set')
  // Service role: purchases and stripe_events are RLS-protected with no anon
  // policy, because they hold every buyer's email address.
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !secret) {
    return NextResponse.json({ error: 'missing signature or secret' }, { status: 400 })
  }

  // Raw text, never request.json(): the signature covers the exact bytes Stripe
  // sent, and re-serialising a parsed object changes them.
  const raw = await request.text()

  if (!verifyStripeSignature(raw, signature, secret)) {
    // Either a misconfigured secret or someone probing the endpoint. Never
    // persist it and never fulfil from it.
    return NextResponse.json({ error: 'signature verification failed' }, { status: 400 })
  }

  let event: { id?: string; type?: string }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'unparseable body' }, { status: 400 })
  }
  if (!event.id || !event.type) {
    return NextResponse.json({ error: 'event missing id or type' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  // Step 1 - persist. The step that must not fail silently.
  const { error: insertError } = await supabase
    .from('stripe_events')
    .upsert(
      { event_id: event.id, event_type: event.type, payload: event },
      { onConflict: 'event_id', ignoreDuplicates: true }
    )

  if (insertError) {
    // The one case worth a non-2xx: we could not store it, so we want it again.
    console.error('stripe_events insert failed', { id: event.id, error: insertError.message })
    return NextResponse.json({ error: 'could not persist event' }, { status: 500 })
  }

  // Step 2 - fulfil. Best effort; the cron is the backstop.
  if (event.type === 'checkout.session.completed') {
    const { data, error } = await supabase.rpc('fulfil_stripe_purchase', { p_event_id: event.id })
    if (error) {
      console.error('fulfil_stripe_purchase failed', { id: event.id, error: error.message })
    } else {
      console.log('fulfilled', { id: event.id, result: data })
    }
  }

  return NextResponse.json({ received: true, id: event.id })
}

// A GET here is almost always a human checking the endpoint is alive.
export async function GET() {
  return NextResponse.json({
    endpoint: 'stripe-webhook',
    healthy: true,
    configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
}
