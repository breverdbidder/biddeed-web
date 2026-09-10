import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { serverError } from '@/lib/api-errors'
import { requireCapability } from '@/lib/tier/server'
import { FL_COUNTIES } from '@/lib/counties'
import { getLayer } from '@/lib/heatmap/config'
import acsData from '@/lib/heatmap/data/fl-county-acs-2024.json'
import type { CountyAcsDataset } from '@/lib/heatmap/types'

export const dynamic = 'force-dynamic'

const ACS = acsData as unknown as CountyAcsDataset

const LIVE_STATUSES = ['upcoming', 'active', 'scheduled']
const LIVE_STATUS_FILTER = `auction_status.in.(${LIVE_STATUSES.join(',')}),auction_status.is.null`
const FORECLOSURE_TYPES = ['foreclosure', 'tax_deed']
const ROW_CAP = 5000
const PAGE_SIZE = 1000

/**
 * GET /api/heatmap/premium?layer=foreclosure_density
 *
 * Paid-gated statewide layer. Only foreclosure_density has real data today —
 * it is BidDeed.AI's own live auction corpus normalized by ACS population,
 * not a Zillow figure, so it is unaffected by the documented Zillow-pipeline
 * gap. Every other premium layer id returns has_data:false rather than a
 * fabricated number (issue #75: "never fabricate").
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const layerId = searchParams.get('layer') || 'foreclosure_density'
  const layer = getLayer(layerId)

  const check = await requireCapability('view_premium_heatmap_layers')
  if (!check.allowed) {
    return NextResponse.json(
      {
        error: 'This layer requires a paid plan.',
        tier_id: check.tierId,
        upgrade_tier: check.upgradeTier ?? 'investor',
        upgrade_price: check.upgradePrice,
      },
      { status: 402 }
    )
  }

  if (!layer || !layer.hasData || layer.id !== 'foreclosure_density') {
    return NextResponse.json(
      {
        layer: layerId,
        has_data: false,
        reason: layer?.noDataReason ?? 'No data source configured for this layer.',
        counties: {},
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const supabase = getRetryingSupabaseClient()
  const countsByCounty = new Map<string, number>()

  try {
    for (let offset = 0; offset < ROW_CAP; offset += PAGE_SIZE) {
      const rangeEnd = Math.min(offset + PAGE_SIZE, ROW_CAP) - 1
      const { data, error } = await supabase
        .from('multi_county_auctions')
        .select('county')
        .in('sale_type', FORECLOSURE_TYPES)
        .or(LIVE_STATUS_FILTER)
        .gte('auction_date', new Date().toISOString().slice(0, 10))
        .range(offset, rangeEnd)
      if (error) throw error
      const page = (data as { county: string }[]) || []
      for (const row of page) {
        countsByCounty.set(row.county, (countsByCounty.get(row.county) ?? 0) + 1)
      }
      if (page.length < rangeEnd - offset + 1) break
    }
  } catch (err) {
    return serverError('heatmap.premium.foreclosure_density', err as Error, 503)
  }

  const counties: Record<string, { value: number; raw_count: number; population: number | null }> = {}
  for (const county of FL_COUNTIES) {
    const rawCount = [...countsByCounty.entries()].find(
      ([name]) => name.toLowerCase() === county.name.toLowerCase()
    )?.[1] ?? 0
    const acsRow = ACS.counties.find((c) => c.county_fips === county.fips)
    const population = acsRow?.population ?? null
    // Per 10,000 residents — normalizes Miami-Dade against Liberty County so
    // the choropleth reads as density, not just raw inventory size.
    const value = population && population > 0 ? Math.round((rawCount / population) * 10000 * 100) / 100 : 0
    counties[county.fips] = { value, raw_count: rawCount, population }
  }

  return NextResponse.json(
    {
      layer: 'foreclosure_density',
      has_data: true,
      source: layer.source,
      vintage: layer.vintage,
      as_of: new Date().toISOString(),
      unit: 'count_per_10k',
      counties,
    },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  )
}
