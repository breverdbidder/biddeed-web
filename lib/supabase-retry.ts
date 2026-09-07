// Shared retry/backoff wrapper for Supabase calls (issue #20090, cli-anything-
// biddeed) — Supabase's whole compute stack (Postgres+PgBouncer+PostgREST+
// GoTrue) bounces together every ~10-15min as of Sep 2026, for ~10-30s per
// bounce. This absorbs that window in every API route so it never surfaces
// as a 5xx to a real user, without ever retrying an application-level (4xx)
// error or double-applying a non-idempotent write.
//
// Passed as the `global.fetch` override to `createClient()` (the pattern
// already used by app/api/auctions/summary/route.ts and
// app/api/checkout/confirm/route.ts before this change), so every
// .select()/.insert()/.update()/.upsert()/.rpc() call made through a client
// built with getRetryingSupabaseClient() gets this for free — no per-route
// call-site changes needed beyond swapping the client constructor.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = [150, 450, 1200]
const DEFAULT_TIMEOUT_MS = 5000

const PRE_EXECUTION_NETWORK_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'])
const MID_STREAM_NETWORK_CODES = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT'])
const PRE_EXECUTION_PG_CODES = new Set(['57P03']) // "the database system is not yet accepting connections"
const AMBIGUOUS_PG_CODES = new Set(['57P01', '57P02', '08000', '08003', '08006'])
// Cloudflare's own edge in front of *.supabase.co, synthesized when it can't
// reach the origin at all (confirmed live during the #20090 restart test:
// 521/522/523/524 arrive as an HTML error page, never touching PostgREST).
// This is the clearest possible "nothing executed" signal — even safer to
// retry than our own ECONNREFUSED, since Cloudflare itself never opened a
// connection to Postgres.
const PRE_EXECUTION_EDGE_STATUS = new Set([521, 522, 523, 524])

export type RetryMode = 'full' | 'connect-only'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function networkErrorCode(err: unknown): string | null {
  const anyErr = err as { cause?: { code?: string }; code?: string }
  return anyErr?.cause?.code || anyErr?.code || null
}

function isRetryableError(err: unknown, mode: RetryMode): boolean {
  if (PRE_EXECUTION_NETWORK_CODES.has(networkErrorCode(err) || '')) return true
  if (mode !== 'full') return false
  if ((err as { name?: string })?.name === 'AbortError') return true // our own client-side timeout fired
  if (MID_STREAM_NETWORK_CODES.has(networkErrorCode(err) || '')) return true
  if (err instanceof TypeError && /fetch failed|network/i.test(err.message || '')) return true
  return false
}

async function isRetryableResponse(res: Response, mode: RetryMode): Promise<boolean> {
  if (res.status === 503) return true // PostgREST couldn't get a DB connection — query never ran
  if (PRE_EXECUTION_EDGE_STATUS.has(res.status)) return true // Cloudflare never reached the origin
  if (res.status < 500) return false // never retry 4xx application errors
  try {
    const body = await res.clone().json()
    const code = body?.code
    if (PRE_EXECUTION_PG_CODES.has(code)) return true
    if (mode === 'full' && AMBIGUOUS_PG_CODES.has(code)) return true
  } catch {
    // not JSON, or body already consumed — nothing more to learn from it
  }
  return false
}

// PostgREST idempotency signals we can read straight off the request:
//   - GET/HEAD: always read-only, always safe to retry in full.
//   - PATCH/DELETE-by-filter: naturally idempotent (re-applying the same
//     update, or deleting an already-deleted row, is a no-op).
//   - POST with Prefer: resolution=merge-duplicates|ignore-duplicates: an
//     upsert PostgREST itself already treats as safe to redeliver.
//   - Any other POST (plain insert, or an RPC call): we cannot tell from the
//     request alone whether the underlying function/insert is idempotent, so
//     default to connect-only — the conservative, correctness-first choice.
//     Routes calling an RPC they know IS naturally idempotent can override
//     via the `retryMode` option on getRetryingSupabaseClient().
function inferRetryMode(init: RequestInit | undefined): RetryMode {
  const method = (init?.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'PATCH' || method === 'DELETE') return 'full'
  const prefer = (init?.headers as Record<string, string> | undefined)?.['Prefer'] || ''
  if (/resolution=(merge|ignore)-duplicates/.test(prefer)) return 'full'
  return 'connect-only'
}

export async function fetchWithRetry(
  url: RequestInfo | URL,
  init: RequestInit = {},
  opts: { attempts?: number; backoffMs?: number[]; timeoutMs?: number; retryMode?: RetryMode } = {}
): Promise<Response> {
  const attempts = opts.attempts ?? DEFAULT_ATTEMPTS
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const mode = opts.retryMode ?? inferRetryMode(init)

  let lastErr: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal })
      clearTimeout(timer)
      if (res.ok || attempt === attempts - 1 || !(await isRetryableResponse(res, mode))) {
        return res
      }
      await sleep(backoffMs[attempt] ?? backoffMs[backoffMs.length - 1])
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      if (attempt === attempts - 1 || !isRetryableError(err, mode)) throw err
      await sleep(backoffMs[attempt] ?? backoffMs[backoffMs.length - 1])
    }
  }
  throw lastErr
}

// Drop-in replacement for the ad-hoc `createClient(url, key, { global: {
// fetch: ... } })` pattern already used across app/api/** — every call made
// through the returned client is retried per the rules above.
//
// supabase-js issues a POST for every .rpc() call regardless of whether the
// underlying function reads or writes, so inferRetryMode() alone can't tell
// a read-only RPC (e.g. auctions_summary_ssot) from a mutating one. Routes
// that only ever call read-only RPCs on a given client should pass
// `{ retryMode: 'full' }` here to get the stronger retry policy; routes that
// mix reads and non-idempotent RPC writes should leave this unset and let
// per-request inference (or an explicit `retryMode` on that one call —
// fetchWithRetry itself still accepts it) make the safer choice.
export function getRetryingSupabaseClient(
  key: string = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  opts: { retryMode?: RetryMode } = {}
): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (url: RequestInfo | URL, init?: RequestInit) => fetchWithRetry(url, init, opts),
    },
  })
}
