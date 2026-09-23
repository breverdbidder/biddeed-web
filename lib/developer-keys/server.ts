/**
 * Self-serve MCP API keys (PARITY CP-8 / D12 "Developers").
 *
 * All key logic lives in four SECURITY DEFINER RPCs in mocerqjnksmhcjzxrewo
 * (migration cp8_self_serve_api_keys), EXECUTE granted to service_role only:
 *   mcp_self_serve_list_keys(p_clerk_user_id, p_verified_email)
 *   mcp_self_serve_create_key(p_clerk_user_id, p_verified_email)   -- "roll": replaces the active key
 *   mcp_self_serve_revoke_key(p_clerk_user_id, p_verified_email, p_key_id)
 * This file only feeds them the two values we can trust: the Clerk user id of
 * the verified session and the VERIFIED primary email (used once, to link a
 * checkout-created customer to this Clerk account). Nothing from the request
 * body ever reaches them.
 *
 * Keys are stored as SHA-256 only. The plaintext exists once, in the create
 * response, and every response here is Cache-Control: no-store.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { publicOrigin } from '@/lib/public-origin'
import { getRetryingSupabaseClient, type RetryMode } from '@/lib/supabase-retry'

import { EMPTY_LISTING, type BlockReason, type DeveloperKey, type KeyListing } from './shared'

export * from './shared'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

type DeveloperContext =
  | { ok: true; userId: string; email: string | null; supabase: ReturnType<typeof getRetryingSupabaseClient> }
  | { ok: false; status: number; error: string }

/**
 * The verified session plus a service-role client. Returns 401 when signed out
 * and 503 when the server is not configured; it never falls back to the anon key.
 */
export async function requireDeveloperContext(retryMode: RetryMode): Promise<DeveloperContext> {
  let userId: string | null = null
  let email: string | null = null
  try {
    userId = (await auth()).userId
    if (userId) {
      const user = await currentUser()
      const primary = user?.primaryEmailAddress
      email = primary && primary.verification?.status === 'verified' ? primary.emailAddress : null
    }
  } catch {
    userId = null
  }
  if (!userId) return { ok: false, status: 401, error: 'Sign in to manage API keys.' }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { ok: false, status: 503, error: 'API keys are not available right now.' }
  return { ok: true, userId, email, supabase: getRetryingSupabaseClient(key, { retryMode }) }
}

const TRUSTED_ORIGINS = new Set(['https://biddeed.ai', 'https://www.biddeed.ai'])

/**
 * Defence in depth for state-changing calls on top of SameSite=Lax session
 * cookies: a browser always sends Origin on POST/DELETE, and it must be ours.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  return origin === publicOrigin(request) || TRUSTED_ORIGINS.has(origin)
}

export function toListing(data: unknown): KeyListing {
  if (!data || typeof data !== 'object') return EMPTY_LISTING
  const row = data as Partial<KeyListing>
  return {
    customer: Boolean(row.customer),
    tier: typeof row.tier === 'string' ? row.tier : null,
    can_create: Boolean(row.can_create),
    block_reason: (row.block_reason ?? null) as BlockReason | null,
    keys: Array.isArray(row.keys) ? (row.keys as DeveloperKey[]) : [],
  }
}

export async function loadListing(
  supabase: ReturnType<typeof getRetryingSupabaseClient>,
  userId: string,
  email: string | null,
): Promise<KeyListing | null> {
  const { data, error } = await supabase.rpc('mcp_self_serve_list_keys', { p_clerk_user_id: userId, p_verified_email: email })
  if (error) return null
  return toListing(data)
}
