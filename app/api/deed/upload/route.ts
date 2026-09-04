import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Same-origin proxy to the Worker's POST /chat/api/upload (issue #19829 P1).
 * Body and auth pass straight through — this route never inspects file
 * contents, it only exists to get past `connect-src 'self'` (see
 * ../route.ts's header comment for the full CSP reasoning).
 */
const WORKER_UPLOAD_URL =
  process.env.DEED_WORKER_CHAT_URL?.replace(/\/chat\/api$/, '/chat/api/upload') ||
  'https://biddeed.ai/chat/api/upload'

// Matches the Worker's own MAX_UPLOAD_BYTES (8MB raw) * 1.4 base64 overhead
// allowance — reject oversize bodies here too so a slow client doesn't tie up
// this route's request for a file the Worker would refuse anyway.
const MAX_CONTENT_LENGTH = 8 * 1024 * 1024 * 1.4

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-chat-token')
  if (!token) return bad(401, 'Invalid or missing chat session')

  const cl = parseInt(req.headers.get('content-length') || '0', 10)
  if (cl > MAX_CONTENT_LENGTH) return bad(413, 'File too large (8MB max)')

  let bodyText: string
  try {
    bodyText = await req.text()
  } catch {
    return bad(400, 'Invalid request body')
  }

  let upstream: Response
  try {
    upstream = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Chat-Token': token,
        'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)',
      },
      body: bodyText,
      signal: AbortSignal.timeout(60_000),
    })
  } catch (err) {
    return bad(502, `Could not reach the chat service: ${(err as Error).message}`)
  }

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
