import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Same-origin proxy to the Worker's GET/POST /chat/api/projects (issue #19847
 * C3). Same CSP reasoning as ../route.ts and ../identity/route.ts. Only the
 * list + create routes are proxied here — the composer's project selector
 * only needs to list projects and create a new one; per-project files/reports
 * management stays on the Worker's own /chat surface until a Next page for it
 * exists (see the issue body).
 */
const WORKER_PROJECTS_URL =
  process.env.DEED_WORKER_CHAT_URL?.replace(/\/chat\/api$/, '/chat/api/projects') ||
  'https://biddeed.ai/chat/api/projects'

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-chat-token')
  if (!token) return bad(401, 'Invalid or missing chat session')

  let upstream: Response
  try {
    upstream = await fetch(WORKER_PROJECTS_URL, {
      headers: { 'X-Chat-Token': token, 'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)' },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    return bad(502, `Could not reach the chat service: ${(err as Error).message}`)
  }

  const text = await upstream.text()
  return new NextResponse(text, { status: upstream.status, headers: { 'Content-Type': 'application/json' } })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-chat-token')
  if (!token) return bad(401, 'Invalid or missing chat session')

  let bodyText: string
  try {
    bodyText = await req.text()
  } catch {
    return bad(400, 'Invalid request body')
  }

  let upstream: Response
  try {
    upstream = await fetch(WORKER_PROJECTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Chat-Token': token,
        'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)',
      },
      body: bodyText,
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    return bad(502, `Could not reach the chat service: ${(err as Error).message}`)
  }

  const text = await upstream.text()
  return new NextResponse(text, { status: upstream.status, headers: { 'Content-Type': 'application/json' } })
}
