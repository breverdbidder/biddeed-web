'use client'

import { useMemo, useState } from 'react'
import { MapPin, Search } from 'lucide-react'

export type CountyCardRow = {
  county: string
  county_display: string
  upcoming: number
  next_auction: string | null
  is_gold_standard: boolean
  sale_types: string
}

function slugify(county: string): string {
  return county.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Audit P2-14: /counties rendered all 67 cards with no way to scan. The grid
 * now carries a filter matching on county name. (First cut tried sticky
 * positioning; AppShell's site-wide overflow-x-hidden wrapper neutralizes
 * position:sticky everywhere, so the filter sits at the top of the grid -
 * the audit's core need is filtering before scrolling through 67 cards.)
 */
export default function CountyGrid({ counties }: { counties: CountyCardRow[] }) {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return counties
    return counties.filter((c) => c.county_display.toLowerCase().includes(q))
  }, [counties, query])

  return (
    <>
      <div className="mt-8">
        <label className="relative block">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">Filter counties</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter counties"
            className="h-11 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No counties match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <li key={c.county}>
              <a
                href={`/county/${slugify(c.county)}`}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
                    {c.county_display}
                  </span>
                  {c.is_gold_standard ? (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
                      Gold Standard
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="tabular font-display text-2xl font-medium tracking-tight text-foreground">
                    {c.upcoming}
                  </span>
                  <span className="text-sm text-muted-foreground">upcoming</span>
                </p>
                <p className="mt-2 text-base text-muted-foreground">
                  {c.next_auction ? `Next sale ${c.next_auction}` : 'No sale currently scheduled'}
                </p>
                <p className="mt-1 text-base capitalize text-muted-foreground">
                  {c.sale_types.replace(/\+/g, ' + ').replace(/_/g, ' ')}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
