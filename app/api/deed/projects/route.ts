import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Projects (Claude.ai Projects parity, C3) land with PARITY CP-4, keyed on the
 * Clerk `sub` like app/api/deed/threads. Until then this route answers 503
 * without reading anything: the previous proxy relayed the Worker's
 * email-claim identity (issue #20226), and CP-3's rule is that no route under
 * app/api/deed reads an email-claim token — this one included.
 */
function coming() {
  return NextResponse.json({ error: 'Saved projects are coming with the next release.' }, { status: 503 })
}

export async function GET() {
  return coming()
}

export async function POST() {
  return coming()
}
