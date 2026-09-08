import { NextRequest, NextResponse } from 'next/server'

import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import { WORKER_MAX_CHARS, WORKER_MAX_MESSAGES, type DeedMessage } from '@/lib/deed/protocol'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Same-origin SSE proxy to the Worker's POST /chat/api, hook 'd4d' (issue
 * #20104 — paired with the Worker-side contract in issue #20103).
 *
 * Mirrors app/api/deed/route.ts almost exactly (same CSP-driven reason for a
 * proxy at all, same CF-Connecting-IP prohibition — see that file's header
 * before touching either). The one addition is route_id/stop_id: D4D Ask Deed
 * questions are asked mid-route ("what is my max bid here"), so the Worker
 * needs to know which stop "here" means. Ownership of that route_id/stop_id
 * is enforced HERE, before the Worker is ever called — the same boundary
 * app/api/d4d/stops/[id]/route.ts already uses, because the Worker has no
 * Clerk session to check it against itself.
 */

const WORKER_CHAT_URL = process.env.DEED_WORKER_CHAT_URL || 'https://biddeed.ai/chat/api'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function clientIp(req: NextRequest): string | null {
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
  const check = await requireCapability('build_d4d_route')
  if (!check.allowed || !check.userId) {
    return NextResponse.json(
      { error: 'Ask Deed requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  let body: {
    messages?: unknown
    county?: unknown
    conversation_id?: unknown
    route_id?: unknown
    stop_id?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid JSON')
  }

  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) return bad(400, 'messages required')
  if (messages.length > WORKER_MAX_MESSAGES) return bad(400, 'Too many messages')

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

  const routeId = typeof body.route_id === 'string' && UUID_RE.test(body.route_id) ? body.route_id : null
  const stopId = typeof body.stop_id === 'string' && UUID_RE.test(body.stop_id) ? body.stop_id : null
  if (body.route_id != null && !routeId) return bad(400, 'Invalid route identifier')
  if (body.stop_id != null && !stopId) return bad(400, 'Invalid stop identifier')

  if (routeId) {
    const supabase = getRetryingSupabaseClient()
    const { data: route, error: routeError } = await supabase
      .from('d4d_routes')
      .select('user_id')
      .eq('id', routeId)
      .maybeSingle()
    if (routeError) return bad(502, 'Unable to verify this route.')
    if (!route || route.user_id !== check.userId) return bad(404, 'Route not found.')

    if (stopId) {
      const { data: stop, error: stopError } = await supabase
        .from('d4d_route_stops')
        .select('id')
        .eq('id', stopId)
        .eq('route_id', routeId)
        .maybeSingle()
      if (stopError) return bad(502, 'Unable to verify this stop.')
      if (!stop) return bad(404, 'Stop not found.')
    }
  } else if (stopId) {
    return bad(400, 'stop_id requires route_id')
  }

  const ip = clientIp(req)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)',
  }
  // NEVER set CF-Connecting-IP here — see app/api/deed/route.ts header comment.
  if (ip) headers['X-Deed-Client-IP'] = ip
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
        hook: 'd4d',
        conversation_id: typeof body.conversation_id === 'string' ? body.conversation_id : undefined,
        route_id: routeId ?? undefined,
        stop_id: stopId ?? undefined,
      }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (err) {
    // Upstream detail (host, status, adapter message) stays server-side.
    console.error(JSON.stringify({ level: 'error', scope: 'd4d.ask', detail: (err as Error).message, ts: new Date().toISOString() }))
    return bad(502, 'Could not reach the chat service. Please retry shortly.')
  }

  if (!upstream.ok || !upstream.body) {
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
      'X-Accel-Buffering': 'no',
    },
  })
}
