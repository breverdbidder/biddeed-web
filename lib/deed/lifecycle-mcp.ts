import { currentUser } from '@clerk/nextjs/server'

/**
 * The app's single doorway to Deed's lifecycle tools (issue #20664).
 *
 * Calls mcp.biddeed.ai/internal/lifecycle with an HMAC-SHA256 signature over
 * `${ts}.${rawBody}`, keyed on the Supabase service-role key this app and the
 * Worker already share (no new secret). The body carries only the Clerk id and
 * the Clerk-VERIFIED email read from the session on this request; nothing the
 * visitor typed picks the customer. Server-only.
 */
const MCP_INTERNAL_URL = process.env.DEED_LIFECYCLE_URL || 'https://mcp.biddeed.ai/internal/lifecycle'

export interface Verified {
  userId: string
  email: string
}

/** Clerk id + primary email, only if Clerk has verified that email. */
export async function verifiedIdentity(): Promise<Verified | null> {
  try {
    const user = await currentUser()
    const primary = user?.primaryEmailAddress ?? user?.emailAddresses?.[0]
    if (!user?.id || !primary?.emailAddress || primary.verification?.status !== 'verified') return null
    return { userId: user.id, email: primary.emailAddress.trim().toLowerCase() }
  } catch {
    return null
  }
}

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface McpReply<T = Record<string, unknown>> {
  ok: boolean
  result?: T
  code?: string
  error?: string
  [k: string]: unknown
}

export async function callLifecycle<T = Record<string, unknown>>(
  who: Verified,
  op: { op: 'call'; tool: string; args?: Record<string, unknown> } | { op: 'confirm'; ref: string },
  channel: 'chat' | 'voice' = 'chat'
): Promise<McpReply<T>> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return { ok: false, code: 'NOT_CONFIGURED' }
  const raw = JSON.stringify({ ...op, clerk_user_id: who.userId, email: who.email, channel })
  const ts = String(Date.now())
  try {
    const res = await fetch(MCP_INTERNAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-askdeed-ts': ts, 'x-askdeed-sig': await hmacHex(key, `${ts}.${raw}`) },
      body: raw,
      signal: AbortSignal.timeout(25_000),
    })
    const json = (await res.json().catch(() => ({}))) as McpReply<T>
    if (!res.ok) return { ok: false, code: json.code || `HTTP_${res.status}`, error: json.error as string | undefined }
    return json
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', scope: 'deed.lifecycle', detail: (err as Error).message, ts: new Date().toISOString() }))
    return { ok: false, code: 'UNREACHABLE' }
  }
}
