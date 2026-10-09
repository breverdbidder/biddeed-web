import { NextRequest, NextResponse } from 'next/server'

import { aguiResponse, runLifecycle, readLifecycleIntent } from '@/lib/deed/lifecycle-run'
import { verifiedIdentity } from '@/lib/deed/lifecycle-mcp'
import { sameOrigin } from '@/lib/deed/same-origin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/deed/run — one Ask Deed lifecycle turn as an AG-UI event stream
 * (issue #20664, ASKDEED-3). Identity is the Clerk-verified account on this
 * request, never anything in the body. A message that is not a plan / billing
 * request gets 204 so the client sends it down the normal chat path unchanged.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { text?: unknown; thread_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const text = typeof body.text === 'string' ? body.text : ''
  const intent = readLifecycleIntent(text)
  if (!intent) return new NextResponse(null, { status: 204 })

  const who = await verifiedIdentity()
  if (!who) return NextResponse.json({ error: 'Sign in with a verified email to manage your plan in chat.' }, { status: 401 })

  const threadId = typeof body.thread_id === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(body.thread_id) ? body.thread_id : 'adhoc'
  return aguiResponse({ who, threadId, produce: (ctx) => runLifecycle(ctx, intent) })
}
