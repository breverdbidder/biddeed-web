import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getRetryingSupabaseClient } from '@/lib/supabase-retry'

/**
 * Verified identity for Deed's persistence routes (PARITY CP-3, gate D10).
 *
 * The one and only identity is the Clerk `sub` that auth() verifies from the
 * session cookie on this request. No route under app/api/deed reads an email,
 * a token the visitor typed, or a header the visitor could set — the legacy
 * X-Chat-Token (an email the Worker took on the visitor's word) is not
 * accepted anywhere here, which is what makes "unverified email cannot read"
 * true by construction rather than by a check that could drift.
 *
 * Same shape as lib/alerts/server.ts requireAlertContext(), kept separate so
 * a change to the alerts contract cannot loosen this one.
 */
export interface DeedContext {
  userId: string
  supabase: SupabaseClient
}

export type DeedContextResult = { ok: true; ctx: DeedContext } | { ok: false; response: NextResponse }

const USER_ID_RE = /^user_[A-Za-z0-9]{10,}$/

export async function requireDeedContext(): Promise<DeedContextResult> {
  let userId: string | null = null
  try {
    userId = (await auth()).userId
  } catch {
    userId = null
  }
  if (!userId || !USER_ID_RE.test(userId)) {
    return { ok: false, response: NextResponse.json({ error: 'Sign in to save and reopen your chats.' }, { status: 401 }) }
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !key) {
    return { ok: false, response: NextResponse.json({ error: 'Chat history is not configured.' }, { status: 503 }) }
  }
  return { ok: true, ctx: { userId, supabase: getRetryingSupabaseClient(key) } }
}

/**
 * PostgREST tells us when the CP-3 migration has not been applied yet
 * (42P01 undefined_table). Report it as 503 "not configured" — the client
 * treats that exactly like "no history" — instead of a 502 that reads as an
 * outage.
 */
export function dbErrorResponse(error: { code?: string; message?: string } | null, fallback: string) {
  if (error?.code === '42P01') {
    return NextResponse.json({ error: 'Chat history is not configured yet.' }, { status: 503 })
  }
  return NextResponse.json({ error: fallback }, { status: 502 })
}

export const THREAD_ID_RE = /^[A-Za-z0-9_-]{6,40}$/
export const MAX_TURNS = 60
export const MAX_TURNS_BYTES = 200_000
export const MAX_TITLE = 120
