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
let summaryPromise: Promise<ShellCounts> | null = null

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function loadSummary(): Promise<ShellCounts> {
  if (summaryPromise) return summaryPromise

  summaryPromise = fetch(apiUrl('/api/auctions/summary'))
    .then((res) => {
      if (!res.ok) throw new Error(`summary endpoint returned ${res.status}`)
      return res.json()
    })
    .then((json: Record<string, unknown>) => ({
      upcoming: num(json.upcoming),
      counties: num(json.counties_upcoming) ?? num(json.counties),
      total: num(json.total),
      loading: false,
    }))
    .catch(() => {
      // Let the next mount retry rather than caching a failure for the life of
      // the page: a transient 502 should not permanently em-dash the nav.
      summaryPromise = null
      // Every value null: the nav shows em-dashes rather than lying.
      return { upcoming: null, counties: null, total: null, loading: false }
    })

  return summaryPromise
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
