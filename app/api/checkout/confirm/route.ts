import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    global: {
      fetch: (url: RequestInfo | URL, init?: RequestInit) =>
        fetch(url, { ...init, cache: 'no-store' }),
    },
  })

  const { data, error } = await supabase.rpc('confirm_checkout_session', {
    p_session_id: sessionId,
  })

  if (error) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 502 })
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
