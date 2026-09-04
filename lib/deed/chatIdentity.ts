'use client'

import { apiUrl } from '@/lib/api'

/**
 * Chat identity for the Worker's persistence layer (issue #19829 P1).
 *
 * The Worker's `/chat/api/upload` and `/chat/api/projects*` routes require an
 * `X-Chat-Token` — an HMAC-signed "claimed email" (not inbox-verified; see
 * docs/spec/19829-P1.md Deviation 6). This app reuses the exact same
 * localStorage keys the Worker's own `/chat` page writes
 * (`bd_chat_token`/`bd_chat_email`), so a visitor who already identified on
 * `/chat` is recognized here too if the two surfaces ever share an origin —
 * and if they do not, this is simply this app's own copy, at no cost either
 * way.
 */

const TOKEN_KEY = 'bd_chat_token'
const EMAIL_KEY = 'bd_chat_email'

export interface ChatIdentity {
  token: string
  email: string
}

export function getChatIdentity(): ChatIdentity | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const email = localStorage.getItem(EMAIL_KEY)
    if (!token || !email) return null
    return { token, email }
  } catch {
    return null
  }
}

function setChatIdentity(identity: ChatIdentity): void {
  try {
    localStorage.setItem(TOKEN_KEY, identity.token)
    localStorage.setItem(EMAIL_KEY, identity.email)
  } catch {
    /* storage unavailable — identity still lives for this call, not persisted */
  }
}

/**
 * Issues (or reuses) a chat session token for `email`.
 *
 * Resolves `null` on any failure — including the expected 503 when the Worker
 * has no `SUPABASE_SERVICE_ROLE_KEY` bound yet — so callers degrade to
 * anonymous chat rather than blocking the send.
 */
export async function ensureChatIdentity(email: string): Promise<ChatIdentity | null> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return null

  const existing = getChatIdentity()
  if (existing && existing.email === trimmed) return existing

  try {
    const res = await fetch(apiUrl('/api/deed/identity'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string; email?: string }
    if (!data.token || !data.email) return null
    const identity = { token: data.token, email: data.email }
    setChatIdentity(identity)
    return identity
  } catch {
    return null
  }
}
