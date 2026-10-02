import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Ask Deed — same-origin proxy to the orchestrator on mcp.biddeed.ai.
 *
 * Deed (the orchestrator agent) lives with the specialist agents it calls:
 * packages/biddeed-mcp/src/deed/orchestrate.js in cli-anything-biddeed, the
 * same process that serves the ask_deed MCP tool. This route only carries the
 * customer's words there and the plan back, for the same reason /api/deed
 * proxies the chat Worker: the CSP allows connect-src 'self', and the browser
 * never needs a second origin.
 *
 * No identity goes upstream. The plan is built from public records and the
 * storefront's own list, and is the same for every visitor.
 */
const DEED_ASK_URL = process.env.DEED_ASK_URL || 'https://mcp.biddeed.ai/deed/ask'
const MAX_QUERY = 2000

export async function POST(req: NextRequest) {
  let body: { query?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })
  if (query.length > MAX_QUERY) return NextResponse.json({ error: 'That message is too long for Deed to plan from.' }, { status: 400 })

  let upstream: Response
  try {
    upstream = await fetch(DEED_ASK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)',
      },
      body: JSON.stringify({ query }),
      // Five specialists over up to six properties; measured well under this.
      signal: AbortSignal.timeout(45_000),
    })
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', scope: 'deed.plan', detail: (err as Error).message, ts: new Date().toISOString() }))
    return NextResponse.json({ error: 'Deed could not reach the specialist agents. Please retry shortly.' }, { status: 502 })
  }

  const text = await upstream.text().catch(() => '')
  if (!upstream.ok) {
    let error = upstream.status === 429 ? 'Deed is busy right now. Try again in a minute.' : `Deed returned ${upstream.status}`
    try {
      const parsed = JSON.parse(text) as { error?: string | { message?: string } }
      if (typeof parsed.error === 'string') error = parsed.error
    } catch {
      /* keep the status-based message */
    }
    return NextResponse.json({ error }, { status: upstream.status === 429 ? 429 : 502 })
  }
  try {
    return NextResponse.json(JSON.parse(text), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Deed returned an unreadable plan.' }, { status: 502 })
  }
}
