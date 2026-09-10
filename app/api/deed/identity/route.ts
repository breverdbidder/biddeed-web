import { NextRequest, NextResponse } from 'next/server'

import { CHAT_HISTORY_CONTAINED } from '@/lib/deed/threads'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Same-origin proxy to the Worker's POST /chat/api/identity (issue #19829 P1).
 *
 * Exists for the same CSP reason as ../route.ts: `connect-src 'self'` refuses
 * a direct browser fetch to biddeed.ai, so every Worker chat-identity route
 * this app needs gets its own five-line same-origin proxy rather than a CSP
 * carve-out.
 */
const WORKER_IDENTITY_URL =
  process.env.DEED_WORKER_CHAT_URL?.replace(/\/chat\/api$/, '/chat/api/identity') ||
  'https://biddeed.ai/chat/api/identity'

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest) {
  // issue #20226 -- legacy identity issuance is contained (see
  // docs/spec/20226.md); stop issuing/relaying it here too,
  // not just at the Worker, so this route never even makes the upstream call.
  if (CHAT_HISTORY_CONTAINED) return bad(503, 'Saved chat history is temporarily unavailable')
  let body: { email?: unknown }
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid JSON')
  }
  if (typeof body.email !== 'string' || !body.email.includes('@')) {
    return bad(400, 'Valid email required')
  }

  let upstream: Response
  try {
    upstream = await fetch(WORKER_IDENTITY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)',
      },
      body: JSON.stringify({ email: body.email }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    // Upstream detail (host, status, adapter message) stays server-side.
    console.error(JSON.stringify({ level: 'error', scope: 'deed.identity', detail: (err as Error).message, ts: new Date().toISOString() }))
    return bad(502, 'Could not reach the chat service. Please retry shortly.')
  }

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
