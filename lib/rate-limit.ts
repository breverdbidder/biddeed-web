/**
 * SEC-009 / LAUNCH-A (#20035): rate limiter using a fixed window per key.
 *
 * This used to be an in-memory Map, which worked on Vercel's long-lived
 * Node process but is a silent no-op on the current Cloudflare Workers
 * (OpenNext) deployment: Cloudflare gives no single client session affinity
 * to one isolate, so the Map never accumulated hits across requests.
 * Verified live 2026-09-05: 70 rapid GET /api/health calls all returned 200
 * with the old Map-based limiter deployed. Replaced the store with
 * `caches.default` (the Workers Cache API), which the sibling biddeed.ai
 * Worker (cli-anything-biddeed) already proved is colo-shared, via a
 * cf-cache-status: HIT test on /auctions in the same issue. `caches` only
 * exists on the actual Workers runtime, not `next dev` or plain Node, so
 * every accessor below fails open (allowed:true) when it's absent — same
 * fail-open posture the rest of this codebase already uses for rate
 * limiting and other best-effort checks.
 *
 * Read-then-write against the cache is not atomic, so concurrent bursts on
 * the same key can under-count slightly. Acceptable for abuse mitigation,
 * not a hard guarantee — same tradeoff Cloudflare's own binding documents
 * for its "eventually consistent" counters.
 */

type EdgeCache = {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

function getEdgeCache(): EdgeCache | undefined {
  return (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default
}

function cacheKeyFor(bucket: string, identifier: string): Request {
  return new Request(`https://rl.internal.biddeed-web.ai/${bucket}/${encodeURIComponent(identifier)}`)
}

async function readJson<T>(cache: EdgeCache, key: Request): Promise<T | null> {
  try {
    const res = await cache.match(key)
    if (!res) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function writeJson(cache: EdgeCache, key: Request, data: unknown, ttlSeconds: number): Promise<void> {
  try {
    await cache.put(
      key,
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${Math.max(1, ttlSeconds)}` },
      })
    )
  } catch {
    // best-effort — a failed write just means the next request re-reads stale/missing state
  }
}

const BACKOFF_WINDOW_MS = 5 * 60_000 // 5 minutes

interface CountEntry {
  count: number
  resetAt: number
}

interface BackoffEntry {
  count: number
  windowStart: number
}

/**
 * Get the effective limit after progressive backoff.
 * After 3 rate limit hits in 5 minutes, halve the allowed requests.
 */
async function getEffectiveLimit(cache: EdgeCache, identifier: string, baseLimit: number): Promise<number> {
  const hits = await readJson<BackoffEntry>(cache, cacheKeyFor('backoff', identifier))
  if (!hits) return baseLimit
  if (Date.now() - hits.windowStart > BACKOFF_WINDOW_MS) return baseLimit
  if (hits.count >= 3) return Math.floor(baseLimit / 2)
  return baseLimit
}

/**
 * Record a rate limit violation for progressive backoff tracking.
 */
async function recordRateLimitHit(cache: EdgeCache, identifier: string): Promise<void> {
  const key = cacheKeyFor('backoff', identifier)
  const now = Date.now()
  const existing = await readJson<BackoffEntry>(cache, key)
  let next: BackoffEntry
  if (!existing || now - existing.windowStart > BACKOFF_WINDOW_MS) {
    next = { count: 1, windowStart: now }
  } else {
    next = { count: existing.count + 1, windowStart: existing.windowStart }
    if (next.count >= 5) {
      console.warn(`[RATE_LIMIT_ABUSE] ${identifier} hit limit ${next.count} times in window`)
    }
  }
  await writeJson(cache, key, next, Math.ceil((next.windowStart + BACKOFF_WINDOW_MS - now) / 1000))
}

export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number
  /** Window duration in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given identifier (typically IP address or user ID).
 * Fails open (allowed:true) if the Cache API isn't available in this runtime.
 */
export async function checkRateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const cache = getEdgeCache()
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  if (!cache) return { allowed: true, remaining: config.limit - 1, resetAt: now + windowMs }

  const effectiveLimit = await getEffectiveLimit(cache, identifier, config.limit)
  const key = cacheKeyFor('count', identifier)
  const entry = await readJson<CountEntry>(cache, key)

  let count: number
  let resetAt: number
  if (!entry || now > entry.resetAt) {
    count = 1
    resetAt = now + windowMs
  } else {
    count = entry.count + 1
    resetAt = entry.resetAt
  }

  await writeJson(cache, key, { count, resetAt }, Math.ceil((resetAt - now) / 1000))

  if (count > effectiveLimit) {
    await recordRateLimitHit(cache, identifier)
    return { allowed: false, remaining: 0, resetAt }
  }
  return { allowed: true, remaining: effectiveLimit - count, resetAt }
}

// Preset configurations
export const RATE_LIMITS = {
  /** Auth endpoints: 5 requests per minute (tightened from 10) */
  auth: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
  /** API endpoints: 30 requests per minute */
  api: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
  /** Per-user API limit: 20 requests per minute */
  userApi: { limit: 20, windowSeconds: 60 } as RateLimitConfig,
}
