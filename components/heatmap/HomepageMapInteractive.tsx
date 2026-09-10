'use client'

import { useCallback, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import HeatmapMap from './HeatmapMap'
import { apiUrl } from '@/lib/api'
import { formatCurrency } from '@/lib/scoring'
import { trackHeatmapEvent } from '@/lib/analytics/track'
import { FREE_LAYER_ID, KPI_LAYERS } from '@/lib/heatmap/config'
import { VALUE_SCALE } from '@/lib/heatmap/colorScales'
import { buildHeatmapSearchParams } from '@/lib/heatmap/url-state'
import acsData from '@/lib/heatmap/data/fl-county-acs-2024.json'
import type { CountyAcsDataset, ScorecardResponse } from '@/lib/heatmap/types'

const ACS = acsData as unknown as CountyAcsDataset
const FREE_LAYER = KPI_LAYERS.find((l) => l.id === FREE_LAYER_ID)!

const countyValues: Record<string, number | null> = Object.fromEntries(
  ACS.counties.map((c) => [c.county_fips, c.median_home_value])
)

/**
 * The interactive half of the homepage module — reuses the same HeatmapMap
 * used on /maps, just smaller and with the free layer locked in (issue #75
 * Amendment 2: "do NOT put the full control stack here"). Dynamically
 * imported by HomepageMapModule so mapbox-gl only loads once this is
 * actually on screen.
 */
export default function HomepageMapInteractive() {
  const [selected, setSelected] = useState<{ fips: string; name: string } | null>(null)
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSelect = useCallback((fips: string, name: string) => {
    setSelected({ fips, name })
    setLoading(true)
    trackHeatmapEvent('homepage_map_interact', {
      surface: 'homepage',
      geography_level: 'county',
      geography_id: fips,
      kpi_layer: FREE_LAYER_ID,
    })
    fetch(apiUrl(`/api/heatmap/scorecard?county_fips=${fips}&layer=${FREE_LAYER_ID}`))
      .then((r) => r.json())
      .then((json: ScorecardResponse) => setScorecard(json))
      .catch(() => setScorecard(null))
      .finally(() => setLoading(false))
  }, [])

  const teaserHref = selected
    ? `/maps?${buildHeatmapSearchParams({ layer: FREE_LAYER_ID, granularity: 'county', selected: selected.fips }).toString()}`
    : '/maps'

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_260px]">
      <HeatmapMap
        countyValues={countyValues}
        colorScale={VALUE_SCALE}
        selectedFips={selected?.fips ?? null}
        onSelectCounty={handleSelect}
        compact
        className="h-[42vh] sm:h-[360px]"
      />

      <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{FREE_LAYER.label}</p>
          {selected && scorecard ? (
            <>
              <p className="mt-1 font-display text-lg font-medium text-foreground">{selected.name} County</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {scorecard.market?.value != null ? formatCurrency(scorecard.market.value) : 'No data'} median home
                value · {scorecard.live_auction_count} live auctions
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {FREE_LAYER.source} · {FREE_LAYER.vintage}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? 'Loading county…' : 'Tap a county to see market direction and live auction count.'}
            </p>
          )}
        </div>
        <a
          href={teaserHref}
          onClick={() =>
            trackHeatmapEvent(selected ? 'homepage_area_teaser_click' : 'homepage_to_maps_click', {
              surface: 'homepage',
              geography_id: selected?.fips,
              kpi_layer: FREE_LAYER_ID,
            })
          }
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Explore the full map <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
    </div>
  )
}
