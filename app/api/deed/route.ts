import { NextRequest, NextResponse } from 'next/server'

import { WORKER_MAX_CHARS, WORKER_MAX_MESSAGES, type DeedMessage } from '@/lib/deed/protocol'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Same-origin SSE proxy to the Worker's POST /chat/api.
 *
 * WHY A PROXY AT ALL. The CSP built in middleware.ts sets `connect-src 'self'`
 * plus a named allow-list that does not include biddeed.ai. A browser fetch
 * straight from this app to the Worker is therefore refused before it leaves
 * the page — and adding the host to connect-src is a security-lane change for
 * something a five-line proxy solves. The model path also stays exactly where
 * it already lives: the Worker owns ROUTER_PROXY_KEY and the Smart Router
 * fallback chain (Gemini Flash -> DeepSeek -> Haiku OAuth), and this app never
 * sees a model credential.
 *
 * THE CLIENT IP — READ THIS BEFORE "FIXING" THE HEADERS BELOW.
 *
 * The Worker rate-limits /chat/api per IP, read from CF-Connecting-IP. A
 * server-side proxy presents its own egress IP, so on the face of it this route
 * should forward the caller's address in that header.
 *
 * IT MUST NOT. CF-Connecting-IP is reserved by Cloudflare and cannot be set by
 * a client. Setting it makes the edge reject the request outright, before the
 * Worker ever runs. MEASURED 2026-08-20, same body, same host, three requests:
 *
 *   no special headers            -> 200, SSE streams normally
 *   + CF-Connecting-IP: 203.0.113.9 -> 403, "error code: 1000"
 *   + browser UA, Origin, no CF header -> 200
 *
 * So the header is omitted, and the honest consequence is stated here rather
 * than buried: every visitor arriving through this proxy shares ONE rate-limit
 * bucket at the Worker — the deployment's egress IP. Under load that trips the
 * daily cap for everybody at once and reads as "Deed is down".
 *
 * THE REAL FIX IS A WORKER CHANGE, and it needs a shared secret so the public
 * cannot spoof it: have checkRateLimitV2 prefer X-Deed-Client-IP when the
 * request also carries a proxy key that only this route knows. That is a
 * cross-repo change plus a secret write, which is Ariel's lane. The header is
 * sent below already so the Worker side is a one-line read when it lands;
 * until then it is inert and harmless.
 */

const WORKER_CHAT_URL = process.env.DEED_WORKER_CHAT_URL || 'https://biddeed.ai/chat/api'

function clientIp(req: NextRequest): string | null {
  // x-forwarded-for is a list; the client is the first entry. x-real-ip is the
  // single-value fallback some edges send instead.
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip')
}

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest) {
  let body: {
    messages?: unknown
    county?: unknown
    hook?: unknown
    conversation_id?: unknown
    upload_id?: unknown
    public_records?: unknown
    project_id?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid JSON')
  }

  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) return bad(400, 'messages required')
  if (messages.length > WORKER_MAX_MESSAGES) return bad(400, 'Too many messages')

  // Validate here as well as at the Worker. Same rules, stated twice on purpose:
  // a 400 that crosses the network reads to the user as "Deed is down", while a
  // local rejection can say precisely what was wrong.
  const clean: DeedMessage[] = []
  let chars = 0
  for (const m of messages) {
    const role = (m as { role?: unknown })?.role
    const content = (m as { content?: unknown })?.content
    if (role !== 'user' && role !== 'assistant') return bad(400, 'Invalid message role')
    if (typeof content !== 'string') return bad(400, 'Invalid message content')
    chars += content.length
    clean.push({ role, content })
  }
  if (chars > WORKER_MAX_CHARS) return bad(400, 'Messages too long')

  const ip = clientIp(req)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // A plain fetch() from a datacenter is served fine (measured), but present
    // as what we are rather than as nothing at all.
    'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)',
  }
  // NEVER set CF-Connecting-IP here — see the note above; the edge 403s it.
  if (ip) headers['X-Deed-Client-IP'] = ip
  // Chat identity (issue #19829 P1) — passed straight through so the Worker
  // can attribute this turn, reuse/create the right conversation, and see
  // upload_id/project_id ownership. Anonymous chat (no token) is unaffected.
  const chatToken = req.headers.get('x-chat-token')
  if (chatToken) headers['X-Chat-Token'] = chatToken

  let upstream: Response
  try {
    upstream = await fetch(WORKER_CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: clean,
        county: typeof body.county === 'string' ? body.county : null,
        hook: typeof body.hook === 'string' ? body.hook : 'radar',
        conversation_id: typeof body.conversation_id === 'string' ? body.conversation_id : undefined,
        upload_id: typeof body.upload_id === 'string' ? body.upload_id : undefined,
        public_records: body.public_records === true ? true : undefined,
        project_id: typeof body.project_id === 'string' ? body.project_id : undefined,
      }),
      // The Worker heartbeats every 5s, so a stall longer than this is a real
      // failure rather than a slow model.
      signal: AbortSignal.timeout(120_000),
    })
  } catch (err) {
    return bad(502, `Could not reach the chat service: ${(err as Error).message}`)
  }

  if (!upstream.ok || !upstream.body) {
    // Pass the Worker's own words through — it distinguishes rate limits from
    // bad payloads, and flattening both to "error" loses the difference the
    // user needs.
    const text = await upstream.text().catch(() => '')
    let error = `Chat service returned ${upstream.status}`
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed.error) error = parsed.error
    } catch {
      /* keep the status-based message */
    }
    return NextResponse.json({ error }, { status: upstream.status })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Without this a proxy in front of the app may buffer the whole stream and
      // deliver it as one lump, which looks exactly like the model being slow.
      'X-Accel-Buffering': 'no',
    },
  })
}
