/**
 * SEC-009: In-memory rate limiter using sliding window.
 * Limits requests per IP address and per user to prevent abuse.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Track rate limit violations for progressive backoff
const rateLimitHits = new Map<string, { count: number; windowStart: number }>()
const BACKOFF_WINDOW_MS = 5 * 60_000 // 5 minutes

// Clean up expired entries every 60 seconds
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }

  // Clean up expired backoff tracking
  for (const [key, entry] of rateLimitHits) {
    if (now - entry.windowStart > BACKOFF_WINDOW_MS) {
      rateLimitHits.delete(key)
    }
  }

  // Hard cap to prevent unbounded memory growth
  if (store.size > 10_000) {
    const entries = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
    for (let i = 0; i < entries.length - 5_000; i++) {
      store.delete(entries[i][0])
    }
  }
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
 * Get the effective limit after progressive backoff.
 * After 3 rate limit hits in 5 minutes, halve the allowed requests.
 */
function getEffectiveLimit(key: string, baseLimit: number): number {
  const hits = rateLimitHits.get(key)
  if (!hits) return baseLimit
  const now = Date.now()
  if (now - hits.windowStart > BACKOFF_WINDOW_MS) return baseLimit
  if (hits.count >= 3) return Math.floor(baseLimit / 2)
  return baseLimit
}

/**
 * Record a rate limit violation for progressive backoff tracking.
 */
function recordRateLimitHit(key: string): void {
  const now = Date.now()
  const existing = rateLimitHits.get(key)

  if (!existing || now - existing.windowStart > BACKOFF_WINDOW_MS) {
    rateLimitHits.set(key, { count: 1, windowStart: now })
  } else {
    existing.count++
    if (existing.count >= 5) {
      console.warn(`[RATE_LIMIT_ABUSE] ${key} hit limit ${existing.count} times in window`)
    }
  }
}

/**
 * Check rate limit for a given identifier (typically IP address or user ID).
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  cleanup()

  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const effectiveLimit = getEffectiveLimit(identifier, config.limit)
  const entry = store.get(identifier)

  // No existing entry or window expired — reset
  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: effectiveLimit - 1, resetAt: now + windowMs }
  }

  // Within window — increment
  entry.count++

  if (entry.count > effectiveLimit) {
    recordRateLimitHit(identifier)
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: effectiveLimit - entry.count, resetAt: entry.resetAt }
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
