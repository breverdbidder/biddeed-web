import { NextRequest, NextResponse } from 'next/server'

import { aguiResponse } from '@/lib/deed/lifecycle-run'
import { callLifecycle, verifiedIdentity } from '@/lib/deed/lifecycle-mcp'
import { CUSTOM, ev, type DeedEvent } from '@/lib/deed/agui'
import { sameOrigin } from '@/lib/deed/same-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/deed/confirm — the ONLY place a confirm token is redeemed
 * (issue #20664, ASKDEED-4). It requires the Clerk session of the customer the
 * token was issued to, a same-origin browser POST, and the opaque ref from the
 * confirm card. Model text, tool results and AG-UI events cannot reach it. The
 * redemption is atomic and single-use on the server (5-minute expiry, bound to
 * customer and action); this route only carries the click.
 */
const REF_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const WHY: Record<string, string> = {
  already_used: 'That confirmation was already used, so nothing new was started. Ask me again if you want another.',
  expired: 'That confirmation expired. Ask me again and I’ll prepare a fresh one.',
  not_found: 'I could not find that confirmation. Ask me again and I’ll prepare a fresh one.',
  PRICE_CHANGED: 'The price changed since you were quoted, so I stopped. Ask again for a fresh quote.',
  not_available: 'That action is not available in chat yet. Nothing was changed.',
  NO_ACTIVE_PLAN: 'There is no active plan to change on this account.',
  NO_BILLING_ACCOUNT: 'There is no paid plan on this account yet.',
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let body: { ref?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const ref = typeof body.ref === 'string' ? body.ref : ''
  if (!REF_RE.test(ref)) return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 })

  const who = await verifiedIdentity()
  if (!who) return NextResponse.json({ error: 'Sign in with a verified email to confirm.' }, { status: 401 })

  return aguiResponse({
    who,
    threadId: 'confirm',
    produce: async (ctx) => {
      const r = await callLifecycle<Record<string, unknown>>(who, { op: 'confirm', ref })
      if (typeof r.customer_id === 'string') ctx.customerId = r.customer_id
      const url = typeof r.url === 'string' ? r.url : null
      ctx.emit(ev.toolCall('Creating your secure checkout', {}, { ok: Boolean(r.ok && url) }) as DeedEvent[])
      if (!r.ok || !url) {
        const code = String(r.code || '')
        ctx.emit(ev.text(WHY[code] || (typeof r.error === 'string' ? r.error : 'That did not go through. Nothing was charged.')) as DeedEvent[])
        return
      }
      const action = String(r.action || 'checkout')
      if (action === 'checkout') {
        ctx.emit(ev.custom(CUSTOM.checkoutCard, { url, product: r.product, amount_usd: r.amount_usd }) as DeedEvent)
        ctx.emit(ev.text('Your secure checkout is ready. Enter payment on that page — I never see or ask for card details.') as DeedEvent[])
      } else {
        ctx.emit(ev.custom(CUSTOM.linkCard, { label: action === 'cancel' ? 'Continue to cancel your plan' : 'Continue to change your plan', url }) as DeedEvent)
        ctx.emit(ev.text('Your billing page is ready. Nothing changes until you finish there.') as DeedEvent[])
      }
    },
  })
}
