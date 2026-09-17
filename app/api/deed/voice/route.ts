import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Mints the signed ElevenLabs WebSocket URL for a Deed voice session
 * (PARITY CP-2 §3 — the composer mic is voice).
 *
 * Same Supabase Edge Function the Worker's /chat page calls directly
 * (`elevenlabs-signed-url`, src/worker.js "Voice Widget"); proxied here so the
 * page never learns the function URL, the call works on every origin this app
 * is served from, and the agent id lives in one place. The function holds the
 * ElevenLabs API key — this route holds nothing and forwards nothing from the
 * caller but the agent id.
 *
 * The signed URL is single-use and short-lived; the browser opens it as a
 * WebSocket (wss://api.elevenlabs.io is already in middleware.ts connect-src).
 */
const SIGNED_URL_ENDPOINT =
  process.env.DEED_VOICE_SIGNED_URL_ENDPOINT ||
  'https://mocerqjnksmhcjzxrewo.supabase.co/functions/v1/elevenlabs-signed-url'
// Public agent identifier — it ships in the Worker's own page markup already.
const AGENT_ID = process.env.DEED_VOICE_AGENT_ID || 'agent_5301kzeg7pj8ezrbaarvkyyfgyd9'

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(_req: NextRequest) {
  let upstream: Response
  try {
    upstream = await fetch(SIGNED_URL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'BidDeed.AI-Deed/1.0 (+https://biddeed.ai)' },
      body: JSON.stringify({ agent_id: AGENT_ID }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', scope: 'deed.voice', detail: (err as Error).message, ts: new Date().toISOString() }))
    return bad(502, 'Could not reach the voice service. Please retry shortly.')
  }
  if (!upstream.ok) return bad(502, `Voice service returned ${upstream.status}`)
  const data = (await upstream.json().catch(() => null)) as { signed_url?: string } | null
  if (!data?.signed_url) return bad(502, 'Voice service returned no session URL')
  return NextResponse.json({ signed_url: data.signed_url }, { headers: { 'Cache-Control': 'no-store' } })
}
