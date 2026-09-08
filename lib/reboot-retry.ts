'use client'

import { useEffect, useState } from 'react'

/**
 * Reboot-aware retry for the error boundaries (G-STATES item 2, #20184).
 *
 * The Supabase instance reboots roughly every 15 minutes for ~60s (ticket
 * SU-464934, unresolved) and Cloudflare's stale-if-error already masks most
 * of that. An error boundary mounting at all means the fault outlasted the
 * cache, so it retries silently across a window comfortably longer than one
 * reboot (~90s total) before showing the bidder anything.
 *
 * State lives in sessionStorage, not component state, because Next may
 * remount the boundary on every reset() call and a counter that resets to
 * zero on remount would retry forever.
 */
const RETRY_DELAYS_MS = [15_000, 30_000, 45_000] // cumulative 15s, 45s, 90s
const STORAGE_KEY = 'bd-error-retry'
// A "fresh" unrelated error arriving long after the last attempt starts the
// count over rather than inheriting a stale exhausted count.
const STALE_AFTER_MS = 120_000

interface RetryState {
  count: number
  firstAt: number
}

function readState(): RetryState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { count: 0, firstAt: Date.now() }
    const parsed = JSON.parse(raw) as RetryState
    if (Date.now() - parsed.firstAt > STALE_AFTER_MS) return { count: 0, firstAt: Date.now() }
    return parsed
  } catch {
    return { count: 0, firstAt: Date.now() }
  }
}

function writeState(state: RetryState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage unavailable (private mode, quota) — the hook still
    // works, it just retries from attempt 0 every remount instead of
    // resuming a count. Silent auto-retry stays silent either way.
  }
}

export function clearRebootRetryState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // see readState/writeState — non-fatal.
  }
}

export function useRebootAwareRetry(error: Error, reset: () => void) {
  const [phase, setPhase] = useState<'retrying' | 'failed'>('retrying')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const state = readState()
    if (state.count >= RETRY_DELAYS_MS.length) {
      clearRebootRetryState()
      setPhase('failed')
      return
    }
    setAttempt(state.count + 1)
    const delay = RETRY_DELAYS_MS[state.count]
    // eslint-disable-next-line no-console
    console.info(
      `[error-boundary] retry ${state.count + 1}/${RETRY_DELAYS_MS.length} in ${delay}ms —`,
      error.message
    )
    const timer = setTimeout(() => {
      writeState({ count: state.count + 1, firstAt: state.firstAt })
      reset()
    }, delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  return { phase, attempt, totalAttempts: RETRY_DELAYS_MS.length }
}
