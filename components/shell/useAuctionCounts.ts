'use client'

import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/api'

export interface ShellCounts {
  upcoming: number | null
  counties: number | null
  total: number | null
  /** false once the request has settled, success or failure. */
  loading: boolean
}

/**
 * Live nav counters, straight off auctions_summary_ssot() via
 * /api/auctions/summary.
 *
 * There is deliberately no fallback number. If the request has not landed, or
 * landed badly, the value stays null and the nav renders an em-dash — never a
 * hardcoded count and never a 0, because "0 upcoming auctions in Florida" and
 * "the summary endpoint is down" look identical to a user and only one of them
 * is ever true.
 *
 * The fetch goes through apiUrl(); basePath is not applied to raw fetch().
 */
/**
 * One in-flight request per page, shared by every consumer.
 *
 * MEASURED 2026-08-20: a single load of /radar?view=calendar issued FIVE
 * identical GETs to /api/auctions/summary — the topbar, the sidebar badge, the
 * summary cards and the page each mounted their own copy of this hook, and
 * each one fired its own effect. Every one of those is a round trip to
 * auctions_summary_ssot(), which aggregates 109k rows.
 *
 * The promise is memoised at module scope rather than in a context provider on
 * purpose: consumers of this hook are scattered across the shell and the page
 * tree with no common ancestor below the layout, and a provider would force
 * every one of them to be a child of it. Module scope is per-document in the
 * browser, so this is a page-lifetime cache, not a cross-user one.
 *
 * There is deliberately NO abort on unmount any more. Aborting a shared
 * promise because one of five subscribers unmounted would cancel the request
 * out from under the other four — the classic bug that turns a dedupe into a
 * flake.
 */
let summaryJsonPromise: Promise<Record<string, unknown>> | null = null

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * The raw /api/auctions/summary body, fetched at most once per page.
 *
 * MEASURED 2026-10-09 (REA teardown, /radar journey): the dedupe above still
 * left TWO identical summary GETs per /radar load, because AuctionsLayout ran
 * its own fetch for the full body (by_county, by_type, cards) next to this
 * hook's request for the nav counters. Both now share this one promise; the
 * hook derives its counters from the same body the page renders, so the nav
 * and the cards can never disagree within a page.
 *
 * Retries a transient upstream failure (5xx or network) twice with backoff:
 * the summary RPC intermittently 500s on a cold start (observed 2026-08-20).
 * A 4xx is a real answer and is not retried. On final failure the memo is
 * cleared so a later mount can try again instead of caching the failure for
 * the life of the page.
 */
export function loadSummaryJson(): Promise<Record<string, unknown>> {
  if (summaryJsonPromise) return summaryJsonPromise

  summaryJsonPromise = (async () => {
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(apiUrl('/api/auctions/summary'))
        if (res.ok) return (await res.json()) as Record<string, unknown>
        const err = new Error(`summary endpoint returned ${res.status}`)
        if (res.status < 500) throw err
        lastErr = err
      } catch (err) {
        if (err instanceof Error && /returned 4\d\d$/.test(err.message)) throw err
        lastErr = err
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
    }
    throw lastErr instanceof Error ? lastErr : new Error('summary endpoint unreachable')
  })().catch((err) => {
    summaryJsonPromise = null
    throw err
  })

  return summaryJsonPromise
}

function loadSummary(): Promise<ShellCounts> {
  return loadSummaryJson()
    .then((json) => ({
      upcoming: num(json.upcoming),
      counties: num(json.counties_upcoming) ?? num(json.counties),
      total: num(json.total),
      loading: false,
    }))
    .catch(() => {
      // Every value null: the nav shows em-dashes rather than lying.
      return { upcoming: null, counties: null, total: null, loading: false }
    })
}

export function useAuctionCounts(): ShellCounts {
  const [counts, setCounts] = useState<ShellCounts>({
    upcoming: null,
    counties: null,
    total: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    loadSummary().then((next) => {
      if (!cancelled) setCounts(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return counts
}

/** Renders a count, or an em-dash when it is unknown or zero. */
export function formatCount(value: number | null): string {
  if (value == null || value === 0) return '—'
  return value.toLocaleString('en-US')
}
