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
export function useAuctionCounts(): ShellCounts {
  const [counts, setCounts] = useState<ShellCounts>({
    upcoming: null,
    counties: null,
    total: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    fetch(apiUrl('/api/auctions/summary'), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`summary endpoint returned ${res.status}`)
        return res.json()
      })
      .then((json: Record<string, unknown>) => {
        if (cancelled) return
        const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
        setCounts({
          upcoming: num(json.upcoming),
          counties: num(json.counties_upcoming) ?? num(json.counties),
          total: num(json.total),
          loading: false,
        })
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return
        // Leave every value null: the nav shows em-dashes rather than lying.
        setCounts({ upcoming: null, counties: null, total: null, loading: false })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return counts
}

/** Renders a count, or an em-dash when it is unknown or zero. */
export function formatCount(value: number | null): string {
  if (value == null || value === 0) return '—'
  return value.toLocaleString('en-US')
}
