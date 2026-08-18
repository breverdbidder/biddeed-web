'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import AuctionSummaryCards from './AuctionSummaryCards'
import AuctionFilters from './AuctionFilters'
import type { AuctionSummary, ViewMode } from '@/types/auctions'

// FullCalendar requires window — must not render during SSR.
const AuctionCalendar = dynamic(() => import('./AuctionCalendar'), { ssr: false })

// Phase 1d ports only the calendar view (AuctionCalendar/AuctionsLayout/
// AuctionFilters/AuctionSummaryCards). AuctionTable/AuctionMap/AuctionSpreadsheet
// are shard E — not ported here. The view-mode tabs still render (Filters owns
// them) so the control surface matches ZoneWise, but non-calendar tabs show a
// placeholder instead of importing components this shard doesn't own.

interface DayFilter {
  date: string
  saleType?: string
}

export default function AuctionsLayout() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<AuctionSummary | null>(null)

  const [selectedCounty, setSelectedCounty] = useState('')
  const [selectedType, setSelectedType] = useState('')
  // Calendar is the landing view (Ariel, Aug 17 2026): discovery starts with
  // "what is coming up and when", not with a wall of rows.
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [dayFilter, setDayFilter] = useState<DayFilter | null>(null)

  const counties = summary ? Object.keys(summary.by_county).sort() : []

  // Header counts come from the SSOT summary function, not from the length of
  // whatever page happens to be loaded. The old header multiplied two wrong
  // numbers together: `total` from the current query and `counties.length`
  // from a PostgREST-truncated 1,000-row sample, which is where "34 Florida
  // counties" came from while 56 counties have upcoming auctions.
  const headerTotal = summary?.total ?? 0
  const headerCounties = summary?.counties ?? counties.length

  useEffect(() => {
    const init = async () => {
      try {
        await fetchSummary()
      } catch (err) {
        console.error('Init failed:', err)
        // Surface the real failure. This page used to swallow both fetch
        // errors and then render "0 auctions across 0 Florida counties" with
        // permanent skeleton cards - visually identical to a site that has no
        // data at all, which is the worst possible way to fail.
        setError(
          `Could not load auction data: ${err instanceof Error ? err.message : 'unknown error'}`
        )
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchSummary() {
    const res = await fetch('/api/auctions/summary')
    if (!res.ok) throw new Error(`summary endpoint returned ${res.status}`)
    setSummary(await res.json())
  }

  function handleSelectDay(date: string, saleType?: string) {
    setDayFilter({ date, saleType })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-bd-navy-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">Loading auctions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm text-blue-500 underline">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Auction Intelligence</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {headerTotal.toLocaleString()} auctions across {headerCounties} Florida counties
            {summary?.upcoming ? (
              <>
                {' '}&middot;{' '}
                <span className="text-gray-700 dark:text-slate-300 font-medium">
                  {summary.upcoming.toLocaleString()} upcoming
                </span>
                {summary.counties_upcoming ? ` in ${summary.counties_upcoming} counties` : ''}
              </>
            ) : null}
          </p>
        </div>

        <AuctionSummaryCards summary={summary} loading={false} />

        <AuctionFilters
          counties={counties}
          selectedCounty={selectedCounty}
          selectedType={selectedType}
          viewMode={viewMode}
          onCountyChange={setSelectedCounty}
          onTypeChange={setSelectedType}
          onViewModeChange={setViewMode}
        />

        {dayFilter && (
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bd-navy-500/10 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
              Showing{' '}
              {dayFilter.saleType === 'tax_deed'
                ? 'tax deed'
                : dayFilter.saleType === 'foreclosure'
                  ? 'foreclosure'
                  : 'all'}{' '}
              auctions on{' '}
              <span className="font-semibold">
                {new Date(dayFilter.date + 'T00:00:00').toLocaleDateString()}
              </span>
              <button
                onClick={() => setDayFilter(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 text-base leading-none"
                aria-label="Clear day filter"
              >
                &times;
              </button>
            </span>
          </div>
        )}

        {viewMode === 'calendar' && (
          <AuctionCalendar
            county={selectedCounty}
            saleType={selectedType}
            onSelectDay={handleSelectDay}
          />
        )}
        {viewMode !== 'calendar' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-8 text-center text-sm text-gray-500 dark:text-slate-400">
            The {viewMode} view ships in a later phase — switch back to Calendar in the meantime.
          </div>
        )}
      </div>
    </div>
  )
}
