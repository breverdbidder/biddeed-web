'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import { apiUrl } from '@/lib/api'

/**
 * AuctionRadar calendar.
 *
 * Previously this component received a page of rows as a prop and mapped them
 * to events. The parent fetched /api/auctions with no date filter, and that
 * route sorted auction_date DESC, so the 200 rows it held were the farthest
 * FUTURE auctions (2027). The calendar opened on the current month, found none
 * of them in view, and rendered an empty grid - with 2,157 real auctions in
 * the next 45 days sitting in the table.
 *
 * It now owns its own data: on every view change it asks
 * /api/auctions/calendar for per-day typed COUNTS over exactly the visible
 * range, and renders them as day-cell badges ("23 Foreclosures", "6 Tax
 * Deeds"),
 * not as one event per property. Clicking a badge drills into that day's list.
 *
 * Colour is keyed on sale_type, never auction_type - auction_type is NULL on
 * 12,959 rows, which is why every event used to render in the fallback colour.
 */

interface DayCounts {
  date: string
  foreclosure_count: number
  tax_deed_count: number
  other_count: number
  total: number
}

interface Totals {
  foreclosure_count: number
  tax_deed_count: number
  other_count: number
  total: number
  days_with_auctions: number
}

interface Props {
  county?: string
  saleType?: string
  onSelectDay?: (date: string, saleType?: string) => void
}

const TYPE_STYLE: Record<string, { bg: string; border: string; label: string }> = {
  foreclosure: { bg: '#EF4444', border: '#DC2626', label: 'Foreclosures' },
  tax_deed: { bg: '#F59E0B', border: '#D97706', label: 'Tax Deeds' },
  other: { bg: '#3B82F6', border: '#2563EB', label: 'Other' },
}

function plural(n: number, label: string) {
  return n === 1 ? `${n} ${label.replace(/s$/, '')}` : `${n} ${label}`
}

export default function AuctionCalendar({ county, saleType, onSelectDay }: Props) {
  const [days, setDays] = useState<DayCounts[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  // The range FullCalendar currently has in view. datesSet only fires on a
  // month/view change, so a county/saleType change needs somewhere else to
  // read "what range am I looking at right now" from.
  const rangeRef = useRef<{ from: string; to: string } | null>(null)
  // Skip the very first run of the county/saleType effect below: it fires on
  // mount before datesSet has ever populated rangeRef, and the initial fetch
  // is already handled by datesSet itself.
  const didMountRef = useRef(false)
  // FullCalendar measures its container once and caches the result. It has no
  // idea the Deed panel just took 480px off the right of the workspace, so it
  // keeps rendering a table sized for the OLD width and the browser clips it.
  // MEASURED in production 2026-08-20 at 1280x800 with Deed open: the month
  // grid rendered 622px wide inside a 462px container and only Sun-Wed were
  // visible - Thu, Fri and Sat were simply gone, with no scroll affordance.
  // updateSize() is FullCalendar's own remedy; a ResizeObserver is what makes
  // it fire for EVERY cause of a width change (panel toggle, sidebar collapse,
  // window resize) rather than only the one we happened to think of.
  const calendarRef = useRef<FullCalendar | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)

  const loadRange = useCallback(
    async (from: string, to: string) => {
      const id = ++requestId.current
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ from, to })
        if (county) params.set('county', county)
        if (saleType) params.set('sale_type', saleType)

        const res = await fetch(apiUrl(`/api/auctions/calendar?${params}`))
        if (!res.ok) throw new Error(`calendar request failed (${res.status})`)
        const json = await res.json()
        // Ignore a response that a later view change has already superseded.
        if (id !== requestId.current) return
        setDays(json.days || [])
        setTotals(json.totals || null)
      } catch (err) {
        if (id !== requestId.current) return
        console.error('Failed to fetch calendar counts:', err)
        setError('Could not load auction counts for this range.')
        setDays([])
        setTotals(null)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [county, saleType]
  )

  const handleDatesSet = useCallback(
    (arg: { startStr: string; endStr: string }) => {
      const from = arg.startStr.slice(0, 10)
      // FullCalendar's range end is exclusive, so step back one day.
      //
      // Do this on the LOCAL date string, never on `arg.end` via toISOString().
      // `arg.end` is a local-midnight Date, and in any timezone east of UTC that
      // instant is still the PREVIOUS day in UTC - so toISOString() shifted `to`
      // a day earlier and the last day of the visible range always reported zero
      // auctions. Verified against the real math: TZ=Asia/Jerusalem and
      // TZ=Australia/Sydney both yielded 2026-09-04 for a view whose last visible
      // day is 2026-09-05, while America/New_York and UTC yielded it correctly -
      // which is exactly why the bug survived review from a US timezone. Anchor
      // at 12:00Z so neither a UTC offset nor a DST transition can move the date.
      const endExclusive = new Date(`${arg.endStr.slice(0, 10)}T12:00:00Z`)
      endExclusive.setUTCDate(endExclusive.getUTCDate() - 1)
      const to = endExclusive.toISOString().slice(0, 10)
      rangeRef.current = { from, to }
      loadRange(from, to)
    },
    [loadRange]
  )

  // Changing county or sale type used to fire zero network requests: nothing
  // called loadRange except datesSet, and FullCalendar only calls that on a
  // view/date change. The badges kept showing counts for the PREVIOUS filter
  // under a label that now disagreed with them. Re-run the currently visible
  // range through the new filter instead of waiting for datesSet to refire -
  // it won't, because the visible dates haven't changed.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (rangeRef.current) {
      loadRange(rangeRef.current.from, rangeRef.current.to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county, saleType])

  const events = days.flatMap((d) => {
    const parts: { type: string; count: number }[] = [
      { type: 'foreclosure', count: d.foreclosure_count },
      { type: 'tax_deed', count: d.tax_deed_count },
      { type: 'other', count: d.other_count },
    ]
    return parts
      .filter((p) => p.count > 0)
      .map((p) => {
        const style = TYPE_STYLE[p.type]
        return {
          id: `${d.date}:${p.type}`,
          title: plural(p.count, style.label),
          start: d.date,
          allDay: true,
          backgroundColor: style.bg,
          borderColor: style.border,
          extendedProps: { date: d.date, saleType: p.type, count: p.count },
        }
      })
  })

  useEffect(() => {
    const el = shellRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const ro = new ResizeObserver(() => {
      // Coalesce to one call per frame: a panel slide fires dozens of resize
      // records and updateSize() is a full relayout each time.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => calendarRef.current?.getApi()?.updateSize())
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={shellRef} className="zw-auction-calendar bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
      {/*
        FullCalendar's day badges are click-handled in JS, not native <a> tags
        with a `url`, so FullCalendar never applies its own cursor:pointer to
        them - they compute cursor:auto and give no visual hint they're
        clickable. `:global()` is required because .fc-event is markup
        FullCalendar renders internally, not JSX authored in this file, so
        plain styled-jsx scoping (which only tags literal JSX elements) would
        never match it.
      */}
      <style jsx>{`
        .zw-auction-calendar :global(.fc-event) {
          cursor: pointer;
        }

        /*
         * MOBILE TOOLBAR OVERLAP FIX (Aug 17 2026).
         *
         * FullCalendar renders .fc-toolbar as a no-wrap flex row with
         * justify-content: space-between. Swapping the CSP-blocked data: icon
         * font for text buttons ("< Prev" / "Next >" / Today / Month / List)
         * roughly tripled the width of the left and right chunks, so below
         * ~768px the three chunks overflow the row and paint ON TOP of the
         * month title. Reported from a live phone screenshot.
         *
         * Fix is to stack the chunks on narrow viewports. Do NOT "fix" this by
         * reverting buttonIcons - that reintroduces the font-src block and the
         * arrows go back to being invisible dark rectangles.
         */
        .zw-auction-calendar :global(.fc .fc-toolbar.fc-header-toolbar) {
          flex-direction: column;
          align-items: stretch;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .zw-auction-calendar :global(.fc .fc-toolbar-chunk) {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 0.25rem;
        }
        .zw-auction-calendar :global(.fc .fc-toolbar-title) {
          font-size: 1.05rem;
          line-height: 1.3;
          text-align: center;
        }
        @media (min-width: 768px) {
          .zw-auction-calendar :global(.fc .fc-toolbar.fc-header-toolbar) {
            flex-direction: row;
            align-items: center;
          }
          .zw-auction-calendar :global(.fc .fc-toolbar-title) {
            font-size: 1.5rem;
          }
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-gray-500 dark:text-slate-400">Foreclosure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-gray-500 dark:text-slate-400">Tax Deed</span>
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs">
          {loading && (
            <span className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
              <span className="w-3 h-3 border-2 border-bd-navy-500 border-t-transparent rounded-full animate-spin" />
              Loading counts...
            </span>
          )}
          {!loading && totals && (
            <span className="text-gray-600 dark:text-slate-300">
              <span className="font-semibold text-gray-900 dark:text-white">
                {totals.total.toLocaleString()}
              </span>{' '}
              {totals.total === 1 ? 'property' : 'properties'} across{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {totals.days_with_auctions}
              </span>{' '}
              {totals.days_with_auctions === 1 ? 'auction day' : 'auction days'} in view
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && totals?.total === 0 && (
        <div className="mb-4 px-3 py-2 rounded-md bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-slate-400">
          No auctions scheduled in this range
          {county ? ` for ${county}` : ''}. Try another month or clear the filters.
        </div>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,listWeek',
        }}
        /*
         * buttonIcons={false} is deliberate and must not be reverted.
         *
         * FullCalendar draws prev/next with an embedded `data:` icon font.
         * middleware.ts sets `font-src 'self' https://fonts.gstatic.com` with no
         * `data:` allowance, so the browser blocks that font and both arrows
         * paint as empty dark rectangles - which is why month navigation looked
         * broken even though the buttons were live and datesSet was refetching
         * correctly the whole time. Text labels sidestep the block entirely
         * without loosening CSP site-wide for a glyph.
         *
         * The range is intentionally open in both directions: the table holds
         * auctions back to 2017-04-10, and scrolling into past months is how a
         * bidder reads sale history. Do not add validRange.
         */
        buttonIcons={false}
        buttonText={{
          prev: '‹ Prev',
          next: 'Next ›',
          today: 'Today',
          month: 'Month',
          list: 'List',
        }}
        events={events}
        datesSet={handleDatesSet}
        eventDidMount={(info) => {
          const { date, saleType: type, count } = info.event.extendedProps as {
            date: string
            saleType: string
            count: number
          }
          const label = type === 'other' ? 'auctions' : TYPE_STYLE[type]?.label.toLowerCase() || 'auctions'
          info.el.title = `View ${plural(count, label)} on ${date}`
          info.el.dataset.date = date
          info.el.dataset.saleType = type
          info.el.dataset.count = String(count)
        }}
        eventClick={(info) => {
          const { date, saleType: type } = info.event.extendedProps as {
            date: string
            saleType: string
          }
          onSelectDay?.(date, type === 'other' ? undefined : type)
        }}
        height="auto"
        dayMaxEvents={3}
        eventDisplay="block"
      />
    </div>
  )
}
