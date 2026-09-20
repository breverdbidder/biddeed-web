import { NextRequest, NextResponse } from 'next/server'

import { decide } from '@/lib/support/decision'
import { WORKER_MAX_CHARS, WORKER_MAX_MESSAGES, type DeedMessage } from '@/lib/deed/protocol'
import { PROJECT_ID_RE, projectChatContext } from '@/lib/deed/projects'
import { requireDeedContext } from '@/lib/deed/server'

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

// An attached document is cited by prepending its extracted text to the
// message that references it (PARITY CP-3). The Worker never sees an upload
// id or an identity: the row is read here, for the Clerk `sub` that owns it,
// and the text travels as ordinary message content — so the model answers
// from the document without any email-claim lookup on either side.
//
// BUDGET. The Worker rejects a payload over WORKER_MAX_CHARS (8,000) with
// 400 "Messages too long" — measured in src/worker.js. Everything folded in
// here (an attachment, a project's files) therefore shares the room the
// question leaves, and the oldest history is dropped before any context is
// cut. CP-3 capped a citation at 12,000 chars, above the Worker's whole
// budget; a large PDF would have bounced. Fixed here (CP-4).
const MAX_CITED_CHARS = 6_000
const CONTEXT_RESERVE = 120
const UPLOAD_ID_RE = /^[0-9a-f-]{36}$/i

async function citedDocument(uploadId: string): Promise<{ text: string } | { error: string; status: number }> {
  const auth = await requireDeedContext()
  if (!auth.ok) return { error: 'Sign in to attach documents.', status: 401 }
  const { data, error } = await auth.ctx.supabase
    .from('deed_uploads')
    .select('filename,extracted_text,extraction_status')
    .eq('owner_user_id', auth.ctx.userId)
    .eq('id', uploadId)
    .maybeSingle()
  if (error) return { error: 'Could not read the attached document.', status: error.code === '42P01' ? 503 : 502 }
  if (!data) return { error: 'That attachment is not available.', status: 404 }
  if (data.extraction_status !== 'ok' || !data.extracted_text) {
    return { text: `(The attached file "${data.filename}" could not be read as text; say so and answer from what the customer wrote.)` }
  }
  const body = data.extracted_text.length > MAX_CITED_CHARS ? data.extracted_text.slice(0, MAX_CITED_CHARS) + '\n[document truncated]' : data.extracted_text
  return { text: `Attached document "${data.filename}" — cite it by name when you use it:\n-----\n${body}\n-----` }
}

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

  // Attachment (CP-3): resolve it for the signed-in owner and fold the text
  // into the last user message. upload_id itself is never forwarded.
  const context: string[] = []
  if (typeof body.upload_id === 'string') {
    if (!UPLOAD_ID_RE.test(body.upload_id)) return bad(400, 'Invalid upload id')
    const doc = await citedDocument(body.upload_id)
    if ('error' in doc) return bad(doc.status, doc.error)
    if (clean[clean.length - 1].role !== 'user') return bad(400, 'An attachment needs a user message')
    context.push(doc.text)
  }

  // Project scope (CP-4, S4): the project's own facts and the text of its
  // files, resolved for the signed-in owner. Neither the id nor any identity
  // goes to the Worker; what was folded in is stated back in X-Deed-Cited so
  // the customer's client (and the CI proof) can see it without trusting the
  // model's prose.
  const cited: string[] = []
  if (typeof body.project_id === 'string' && body.project_id) {
    if (!PROJECT_ID_RE.test(body.project_id)) return bad(400, 'Invalid project id')
    const auth = await requireDeedContext()
    if (!auth.ok) return auth.response
    const project = await projectChatContext(auth.ctx.supabase, auth.ctx.userId, body.project_id)
    if (!project.ok) return bad(project.status, project.error)
    if (clean[clean.length - 1].role !== 'user') return bad(400, 'A project scope needs a user message')
    context.push(project.ctx.text)
    cited.push(...project.ctx.cited)
  }

  // Fit the Worker's budget: the question is kept whole, the context takes
  // what the question leaves, and history goes first when there is not enough
  // room for both — a cite turn is about the document, not the small talk.
  if (context.length) {
    const last = clean[clean.length - 1]
    const question = last.content
    let block = context.join('\n\n')
    const room = WORKER_MAX_CHARS - question.length - CONTEXT_RESERVE
    if (room < 400) return bad(400, 'The message is too long to add a document to')
    if (block.length > room) block = block.slice(0, room - 24) + '\n[context truncated]'
    last.content = `${block}\n\n${question}`
    const total = () => clean.reduce((n, m) => n + m.content.length, 0)
    while (clean.length > 1 && total() > WORKER_MAX_CHARS) clean.shift()
  }

  // Local shadow triage only. This never changes the answer, sends no customer
  // text to Jev, and cannot authorize any action. It gives operations a safe
  // fallback signal while the external privacy/cost gate remains closed.
  const lastUserMessage = [...clean].reverse().find((message) => message.role === 'user')?.content ?? ''
  const supportDecision = await decide({ message: lastUserMessage })
  console.info(JSON.stringify({
    level: 'info', scope: 'deed.support-shadow', category: supportDecision.category,
    priority: supportDecision.priority, queue: supportDecision.queue,
    revenue_risk: supportDecision.revenueRisk, requires_human: supportDecision.requiresHuman,
    source: supportDecision.source, confidence: supportDecision.confidence,
    ts: new Date().toISOString(),
  }))

  const ip = clientIp(req)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // A plain fetch() from a datacenter is served fine (measured), but present
    // as what we are rather than as nothing at all.
    'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)',
  }
  // NEVER set CF-Connecting-IP here — see the note above; the edge 403s it.
  if (ip) headers['X-Deed-Client-IP'] = ip
  // No identity of any kind goes to the Worker (PARITY CP-3). Persistence is
  // this app's, keyed on the Clerk sub (app/api/deed/threads); the Worker is
  // the model path only. The legacy X-Chat-Token (issue #20226) is neither
  // read nor forwarded here.

  let upstream: Response
  try {
    upstream = await fetch(WORKER_CHAT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: clean,
        county: typeof body.county === 'string' ? body.county : null,
        hook: typeof body.hook === 'string' ? body.hook : 'radar',
        public_records: body.public_records === true ? true : undefined,
      }),
      // The Worker heartbeats every 5s, so a stall longer than this is a real
      // failure rather than a slow model.
      signal: AbortSignal.timeout(120_000),
    })
  } catch (err) {
    // Upstream detail (host, status, adapter message) stays server-side.
    console.error(JSON.stringify({ level: 'error', scope: 'deed.chat', detail: (err as Error).message, ts: new Date().toISOString() }))
    return bad(502, 'Could not reach the chat service. Please retry shortly.')
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
      // The file names Deed was given for this turn (CP-4) — empty when none.
      'X-Deed-Cited': encodeURIComponent(cited.join('|')),
    },
  })
}
