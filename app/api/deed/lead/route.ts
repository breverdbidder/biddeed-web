import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Same-origin proxy to the Worker's POST /chat/lead — the lead capture behind
 * the voice email gate (source `voice_gate`), identical to what the Worker's
 * own /chat page recorded before /chat moved into this app (PARITY CP-2).
 *
 * Only email, county and source are forwarded; consent fields are not
 * collected on this surface and so are never sent. The Worker rate-limits the
 * route per IP (5/min), so a burst from one visitor is refused upstream.
 */
const WORKER_LEAD_URL =
  process.env.DEED_WORKER_CHAT_URL?.replace(/\/chat\/api$/, '/chat/lead') || 'https://biddeed.ai/chat/lead'

const SOURCES = new Set(['voice_gate', 'chat', 'chat_plus_menu'])

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest) {
  let body: { email?: unknown; county?: unknown; source?: unknown }
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid JSON')
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@') || email.length > 254) return bad(400, 'Valid email required')
  const source = typeof body.source === 'string' && SOURCES.has(body.source) ? body.source : 'chat'
  const county = typeof body.county === 'string' && body.county.length <= 40 ? body.county : null

  let upstream: Response
  try {
    upstream = await fetch(WORKER_LEAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)' },
      body: JSON.stringify({ email, county, source }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', scope: 'deed.lead', detail: (err as Error).message, ts: new Date().toISOString() }))
    return bad(502, 'Could not reach the chat service. Please retry shortly.')
  }
  return NextResponse.json({ ok: upstream.ok }, { status: upstream.ok ? 200 : upstream.status })
}
