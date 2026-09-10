'use client'

import { ArrowRight, MapPinned, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/scoring'
import { trackHeatmapEvent } from '@/lib/analytics/track'
import type { ScorecardResponse } from '@/lib/heatmap/types'
import { getLayer } from '@/lib/heatmap/config'

interface Props {
  loading: boolean
  data: ScorecardResponse | null
  error?: string | null
  onJumpToCounty?: (fips: string) => void
}

function formatMarketValue(value: number | null, unit: string): string {
  if (value == null) return 'No data'
  if (unit === 'usd') return formatCurrency(value)
  if (unit === 'percent') return `${value}%`
  return String(value)
}

function buyReportHref(params: { mcaId: string; county: string }): string {
  const sp = new URLSearchParams({ mca_id: params.mcaId, county: params.county })
  return `/buy-report?${sp.toString()}`
}

/**
 * Scorecard content — market direction (source + vintage), live auction
 * count (as-of), top actionable parcel, SIGNAL$ CTA. Shared between the
 * desktop side panel and the mobile bottom sheet (issue #75 Amendment 1:
 * "popups die at ~700px width and on phones" — this is the popup-only
 * replacement).
 */
export default function ScorecardPanel({ loading, data, error, onJumpToCounty }: Props) {
  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading county scorecard…</div>
    )
  }

  if (error) {
    return <div className="p-4 text-sm text-muted-foreground">{error}</div>
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Click a county on the map to see market direction, live auction count, and the strongest
        actionable parcel there.
      </div>
    )
  }

  const layer = getLayer(data.market?.layer ?? '')

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{data.county_name} County</p>
        <p className="mt-1 text-[11px] text-muted-foreground">As of {new Date(data.as_of).toLocaleString()}</p>
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <TrendingUp className="size-3.5 text-primary" aria-hidden />
          Market direction
        </p>
        <p className="mt-1 font-display text-xl font-medium text-foreground">
          {data.market ? formatMarketValue(data.market.value, data.market.unit) : 'No data'}
        </p>
        {data.market && (
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {layer?.label ?? data.market.layer} · {data.market.source} · {data.market.vintage}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MapPinned className="size-3.5 text-primary" aria-hidden />
          Live auction inventory
        </p>
        <p className="mt-1 font-display text-xl font-medium text-foreground">{data.live_auction_count}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">upcoming, this county, as of {new Date(data.as_of).toLocaleDateString()}</p>
      </div>

      {data.top_parcel ? (
        <div className="rounded-lg border border-primary/40 bg-card p-3">
          <p className="text-xs font-semibold text-foreground">Strongest actionable parcel</p>
          <p className="mt-1 truncate text-sm text-foreground">{data.top_parcel.property_address || 'Address pending'}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
            {data.top_parcel.opening_bid != null && <span>Opening bid {formatCurrency(data.top_parcel.opening_bid)}</span>}
            {data.top_parcel.auction_date && <span>Sale {data.top_parcel.auction_date}</span>}
            <span className="font-semibold text-primary">{data.top_parcel.recommendation}</span>
          </div>
          <a
            href={buyReportHref({ mcaId: data.top_parcel.id, county: data.county_name })}
            onClick={() =>
              trackHeatmapEvent('signal_cta_click', {
                geography_level: 'county',
                geography_id: data.county_fips,
                metadata: { mca_id: data.top_parcel!.id },
              })
            }
            className="mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Buy SIGNAL$ report — $25 <ArrowRight className="size-3.5" aria-hidden />
          </a>
        </div>
      ) : data.nearest_with_inventory ? (
        <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          No live auctions in {data.county_name} County right now.{' '}
          <button
            type="button"
            className="font-semibold text-primary underline underline-offset-2"
            onClick={() => onJumpToCounty?.(data.nearest_with_inventory!.county_fips)}
          >
            {data.nearest_with_inventory.county_name} County has {data.nearest_with_inventory.live_auction_count}
            {' '}upcoming — jump there
          </button>
          .
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          No live auctions found in {data.county_name} County right now.
        </div>
      )}
    </div>
  )
}
