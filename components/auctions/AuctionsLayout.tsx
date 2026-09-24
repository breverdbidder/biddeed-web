'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import AuctionSummaryCards from './AuctionSummaryCards'
import { Skeleton } from '@/components/ui/skeleton'
import AuctionFilters from './AuctionFilters'
import AuctionTable from './AuctionTable'
import AuctionSpreadsheet from './AuctionSpreadsheet'
import AuctionSidebarList from './AuctionSidebarList'
import AuctionPinCard from './AuctionPinCard'
import { formatCountyLabel } from '@/lib/counties'
import type { Auction, AuctionSummary, AuctionsResponse, ViewMode } from '@/types/auctions'
import { apiUrl } from '@/lib/api'

// FullCalendar and Mapbox both require window — must not render during SSR.
const AuctionCalendar = dynamic(() => import('./AuctionCalendar'), { ssr: false })
const AuctionMap = dynamic(() => import('./AuctionMap'), { ssr: false })

interface DayFilter {
  date: string
  saleType?: string
}

interface Props {
  /** View to open on, from ?view= on /radar. Defaults to split. */
  initialView?: ViewMode
  /** County slug from ?county= on /radar. */
  initialCounty?: string
  /** Sale type from ?sale_type= on /radar. */
  initialSaleType?: string
  /**
   * Whether this component should render its own <h1>. Defaults to true for
   * /radar, which has no page-level heading of its own. /auctions already
   * renders its own h1 in app/auctions/page.tsx and passes false so the
   * route carries exactly one.
   */
  showHeading?: boolean
}

export default function AuctionsLayout({
  initialView,
  initialCounty,
  initialSaleType,
  showHeading = true,
}: Props = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [summary, setSummary] = useState<AuctionSummary | null>(null)
  const [total, setTotal] = useState(0)

  // County and sale type live in the URL, not only in component state. Two
  // reasons, both load-bearing: a filtered view is now linkable, and Deed can
  // BOTH read what the user is looking at and act on it -- 'show me Brevard'
  // becomes a push to /radar?county=brevard that this component picks up,
  // rather than an agent that can only talk about filters it cannot touch.
  const [selectedCounty, setSelectedCounty] = useState(initialCounty ?? '')
  const [selectedType, setSelectedType] = useState(initialSaleType ?? '')
  // Split is the landing view: the sidebar answers "what is for sale" and the
  // map answers "where", side by side, which is the whole point of AuctionRadar.
  // The calendar stays one click away for "when".
  const [viewMode, setViewMode] = useState<ViewMode>(initialView ?? 'split')
  // The row the sidebar has highlighted, so the map can fly to it.
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [focusId, setFocusId] = useState<number | string | null>(null)
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)
  const [dayFilter, setDayFilter] = useState<DayFilter | null>(null)

  // The nav rail's Calendar item is /radar?view=calendar, so a click there
  // re-renders this page with a different initialView while the component
  // stays mounted. Without this the rail would highlight Calendar and the
  // workspace would keep showing Split.
  useEffect(() => {
    if (initialView) setViewMode(initialView)
  }, [initialView])

  // Same contract for the filters: a navigation to /radar?county=brevard --
  // from Deed, from a link, from the back button -- re-renders this page with
  // new props while the component stays mounted, so the state has to follow.
  useEffect(() => {
    setSelectedCounty(initialCounty ?? '')
  }, [initialCounty])

  useEffect(() => {
    setSelectedType(initialSaleType ?? '')
  }, [initialSaleType])

  // ...and the reverse: the in-workspace switcher writes the view back to the
  // URL so the rail's active state, the breadcrumb and a copied link all agree.
  // One writer for the whole query string, so view, county and sale type can
  // never clobber each other -- which is exactly what happened when each
  // control wrote its own URL from scratch.
  function pushQuery(next: { view?: ViewMode; county?: string; saleType?: string }) {
    if (pathname !== '/radar') return
    const params = new URLSearchParams()
    const view = next.view ?? viewMode
    const county = next.county ?? selectedCounty
    const saleType = next.saleType ?? selectedType
    if (view && view !== 'split') params.set('view', view)
    if (county) params.set('county', county)
    if (saleType) params.set('sale_type', saleType)
    const qs = params.toString()
    router.replace(qs ? `/radar?${qs}` : '/radar', { scroll: false })
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode)
    pushQuery({ view: mode })
  }

  function changeCounty(county: string) {
    setSelectedCounty(county)
    pushQuery({ county })
  }

  function changeSaleType(saleType: string) {
    setSelectedType(saleType)
    pushQuery({ saleType })
  }

  // Names the active filter for the empty state (G-STATES item 3, #20184) —
  // "No results" alone gives a bidder nothing to act on.
  const saleTypeLabel = selectedType ? (selectedType === 'tax_deed' ? 'tax deed ' : 'foreclosure ') : ''
  const countyLabel = selectedCounty ? ` in ${formatCountyLabel(selectedCounty)} County` : ''
  const dayLabel = dayFilter ? ` on ${new Date(dayFilter.date + 'T00:00:00').toLocaleDateString()}` : ''
  const emptyFilterMessage = `No ${saleTypeLabel}auctions${countyLabel}${dayLabel} right now.`

  function clearFilters() {
    setSelectedCounty('')
    setSelectedType('')
    setDayFilter(null)
    pushQuery({ county: '', saleType: '', view: viewMode })
  }

  const counties = summary ? Object.keys(summary.by_county).sort() : []

  // Header counts come from the SSOT summary function, not from the length of
  // whatever page happens to be loaded. The old header multiplied two wrong
  // numbers together: `total` from the current query and `counties.length`
  // from a PostgREST-truncated 1,000-row sample, which is where "34 Florida
  // counties" came from while 56 counties have upcoming auctions.
  const headerTotal = summary?.total ?? total
  const headerCounties = summary?.counties ?? counties.length

  useEffect(() => {
    const init = async () => {
      try {
        // The calendar and map fetch their own data (per-day counts, and
        // filtered coordinate-only pins) and do not read these rows at all.
        await fetchSummary()
        if (viewMode !== 'calendar' && viewMode !== 'map') await fetchAuctions()
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

  useEffect(() => {
    if (!loading && viewMode !== 'calendar' && viewMode !== 'map') {
      setError(null)
      fetchAuctions().catch((err) => {
        console.error('Failed to fetch auctions:', err)
        setError(
          `Could not load auctions: ${err instanceof Error ? err.message : 'unknown error'}`
        )
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCounty, selectedType, dayFilter, viewMode])

  // Retries a transient upstream failure before surfacing an error. The summary
  // RPC intermittently 500s on a cold start (observed live 2026-08-20); a single
  // one dropped the whole workspace into an error state even though the very next
  // request succeeded. Only 5xx and network faults are retried -- a 4xx is a real
  // answer and will not fix itself by asking again.
  async function fetchSummary() {
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(apiUrl('/api/auctions/summary'))
        if (res.ok) {
          setSummary(await res.json())
          return
        }
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
  }

  async function fetchAuctions() {
    const params = new URLSearchParams({ limit: '200' })
    if (selectedCounty) params.set('county', selectedCounty)
    // sale_type, not type: auction_type is NULL on ~13k rows, so the old
    // `type` filter silently hid real auctions from every filtered view.
    if (selectedType) params.set('sale_type', selectedType)

    if (dayFilter) {
      params.set('from', dayFilter.date)
      params.set('to', dayFilter.date)
      if (dayFilter.saleType) params.set('sale_type', dayFilter.saleType)
    } else {
      // Default the browse list to what is actually coming up.
      params.set('upcoming', 'true')
    }

    const res = await fetch(apiUrl(`/api/auctions?${params}`))
    if (!res.ok) throw new Error(`auctions endpoint returned ${res.status}`)
    const json: AuctionsResponse = await res.json()
    setAuctions(json.data)
    setTotal(json.total)
  }

  function handleSelectDay(date: string, saleType?: string) {
    setDayFilter({ date, saleType })
    // Land on split, not table: picking a day should answer "what is selling
    // that day, and where", not drop the user into a bare grid.
    changeViewMode('split')
  }

  function handleHighlight(auction: Auction) {
    setFocusId(auction.id)
    const lat = auction.latitude as number | null | undefined
    const lng = auction.longitude as number | null | undefined
    setFocusPoint(lat != null && lng != null ? { lat, lng } : null)
  }

  if (loading) {
    // PARITY CP-9: a skeleton in the shape of the loaded page (heading, the
    // five figure tiles, the filter row, the view), not a spinner in an empty
    // band, so nothing jumps when the auctions land.
    return (
      <div className="w-full min-w-0 overflow-x-hidden bg-muted dark:bg-background" aria-busy="true">
        <div className="mx-auto max-w-7xl min-w-0 space-y-6 px-4 py-6 sm:px-6">
          <div>
            {showHeading ? (
              <h1 className="text-xl font-bold text-foreground dark:text-white">Auction Intelligence</h1>
            ) : (
              <p className="text-xl font-bold text-foreground dark:text-white">Auction Intelligence</p>
            )}
            <Skeleton className="mt-2 h-5 w-full max-w-md" />
          </div>
          <AuctionSummaryCards summary={null} loading />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 w-36 md:h-9" />
            <Skeleton className="h-11 w-32 md:h-9" />
            <Skeleton className="h-11 w-full max-w-sm sm:ml-auto md:h-9" />
          </div>
          <Skeleton className="h-[50vh] w-full rounded-lg lg:h-[60vh]" />
          <p role="status" className="sr-only">Loading auctions…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-muted dark:bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-primary text-sm">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium text-primary underline underline-offset-4 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-muted dark:bg-background">
      <div className="mx-auto max-w-7xl min-w-0 space-y-6 px-4 py-6 sm:px-6">
        <div>
          {showHeading ? (
            <h1 className="text-xl font-bold text-foreground dark:text-white">Auction Intelligence</h1>
          ) : (
            <p className="text-xl font-bold text-foreground dark:text-white">Auction Intelligence</p>
          )}
          <p className="text-base text-muted-foreground dark:text-muted-foreground mt-1">
            {headerTotal.toLocaleString()} auctions across {headerCounties} Florida counties
            {summary?.upcoming ? (
              <>
                {' '}&middot;{' '}
                <span className="text-foreground dark:text-muted-foreground font-medium">
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
          onCountyChange={changeCounty}
          onTypeChange={changeSaleType}
          onViewModeChange={changeViewMode}
        />

        {dayFilter && (
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-foreground dark:text-foreground border border-border dark:border-border">
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
              {viewMode !== 'map' && (
                <button
                  onClick={() => changeViewMode('map')}
                  className="text-primary dark:text-primary underline hover:no-underline"
                >
                  View on map
                </button>
              )}
              <button
                onClick={() => setDayFilter(null)}
                className="text-muted-foreground hover:text-foreground dark:hover:text-foreground text-base leading-none"
                aria-label="Clear day filter"
              >
                &times;
              </button>
            </span>
            {viewMode !== 'map' && (
              <span className="text-muted-foreground dark:text-muted-foreground">{total} matching</span>
            )}
          </div>
        )}

        {viewMode === 'split' && (
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:h-[70vh] lg:grid-cols-[380px_minmax(0,1fr)]">
            {/* Sidebar and map are siblings in one fixed-height row so the list
                scrolls independently and the map never gets pushed off-screen
                by a long list. Below lg they stack - a 380px column beside a map
                is unusable on a phone - and the map goes first, because "where"
                is the question the phone screen can actually answer at a glance. */}
            <div className="order-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:order-1 lg:h-auto">
              <AuctionSidebarList
                auctions={auctions}
                selectedId={focusId}
                total={total}
                onHighlight={handleHighlight}
                onOpen={(auction) => router.push(`/radar/${auction.id}`)}
                emptyMessage={emptyFilterMessage}
                onClearFilters={clearFilters}
              />
            </div>
            <div className="order-1 min-h-[280px] min-w-0 h-[45vh] lg:order-2 lg:h-auto">
              <AuctionMap
                county={selectedCounty}
                saleType={selectedType}
                dayFilter={dayFilter}
                onSelectAuction={setSelectedAuction}
                focusPoint={focusPoint}
                fillParent
              />
            </div>
          </div>
        )}
        {viewMode === 'table' && (
          <AuctionTable
            auctions={auctions}
            loading={false}
            onSelectAuction={(auction) => router.push(`/radar/${auction.id}`)}
            emptyMessage={emptyFilterMessage}
            onClearFilters={clearFilters}
          />
        )}
        {viewMode === 'map' && (
          /*
           * fillParent inside a viewport-fit box. MEASURED 2026-08-20: the
           * standalone map's fixed h-[600px] put its bottom edge 89-91px below
           * the fold at 1440x900 - the wrong shape for the view a bidder now
           * lands on. The offset is 25.5rem because the stack above the card
           * (topbar, heading, stat tiles, filter row, honesty banner, margins)
           * measures ~391px; a first attempt with 16rem still ran 89px past
           * the fold.
           */
          <div className="h-[calc(100vh-25.5rem)] min-h-[420px]">
            <AuctionMap
              county={selectedCounty}
              saleType={selectedType}
              dayFilter={dayFilter}
              onSelectAuction={setSelectedAuction}
              fillParent
            />
          </div>
        )}
        {viewMode === 'calendar' && (
          <AuctionCalendar
            county={selectedCounty}
            saleType={selectedType}
            onSelectDay={handleSelectDay}
          />
        )}
        {viewMode === 'spreadsheet' && (
          <AuctionSpreadsheet
            auctions={auctions}
            loading={false}
            onSelectAuction={(auction) => router.push(`/radar/${auction.id}`)}
          />
        )}

        {selectedAuction && (
          <AuctionPinCard auction={selectedAuction} onClose={() => setSelectedAuction(null)} />
        )}
      </div>
    </div>
  )
}
