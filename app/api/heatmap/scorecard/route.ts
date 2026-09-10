import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { serverError } from '@/lib/api-errors'
import { FL_COUNTIES } from '@/lib/counties'
import { pickTopParcel, type CandidateAuctionRow } from '@/lib/heatmap/topParcel'
import { getLayer } from '@/lib/heatmap/config'
import acsData from '@/lib/heatmap/data/fl-county-acs-2024.json'
import type { CountyAcsDataset, ScorecardResponse } from '@/lib/heatmap/types'

export const dynamic = 'force-dynamic'

const ACS = acsData as unknown as CountyAcsDataset

const LIVE_STATUSES = ['upcoming', 'active', 'scheduled']
const LIVE_STATUS_FILTER = `auction_status.in.(${LIVE_STATUSES.join(',')}),auction_status.is.null`

const SELECT_COLUMNS = [
  'id',
  'county',
  'property_address',
  'auction_date',
  'sale_type',
  'opening_bid',
  'assessed_value',
  'market_value',
].join(',')

/**
 * GET /api/heatmap/scorecard?county_fips=009&layer=market_direction
 *
 * Public — the scorecard's live auction count and top parcel are the free
 * funnel hook (Amendment 1: "pins stay visible... across every layer
 * switch"), not a gated KPI. Only the statewide premium layer values
 * (/api/heatmap/premium) are entitlement-gated.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fips = searchParams.get('county_fips')
  const layerId = searchParams.get('layer') || 'market_direction'

  const county = FL_COUNTIES.find((c) => c.fips === fips)
  if (!county) {
    return NextResponse.json({ error: 'unknown or missing county_fips' }, { status: 400 })
  }

  const supabase = getRetryingSupabaseClient()

  let rows: CandidateAuctionRow[] = []
  let liveCount = 0
  try {
    const query = supabase
      .from('multi_county_auctions')
      .select(SELECT_COLUMNS, { count: 'exact' })
      .ilike('county', county.name)
      .or(LIVE_STATUS_FILTER)
      .gte('auction_date', new Date().toISOString().slice(0, 10))
      .order('auction_date', { ascending: true })
      .limit(200)
    const { data, count, error } = await query
    if (error) throw error
    rows = (data as unknown as CandidateAuctionRow[]) || []
    liveCount = count ?? rows.length
  } catch (err) {
    return serverError('heatmap.scorecard.auctions', err as Error, 503)
  }

  let nearestWithInventory: ScorecardResponse['nearest_with_inventory'] = null
  if (rows.length === 0) {
    // Honest empty state (issue #75 risk list: "never invent one") — offer
    // the nearest county that actually has live inventory rather than
    // showing a fabricated parcel for this one.
    try {
      const { data } = await supabase
        .from('multi_county_auctions')
        .select('county', { count: 'exact' })
        .or(LIVE_STATUS_FILTER)
        .gte('auction_date', new Date().toISOString().slice(0, 10))
        .neq('county', county.name)
        .limit(500)
      const counts = new Map<string, number>()
      for (const r of (data as { county: string }[]) || []) {
        counts.set(r.county, (counts.get(r.county) ?? 0) + 1)
      }
      const [bestCounty, bestCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || []
      if (bestCounty) {
        const match = FL_COUNTIES.find((c) => c.name.toLowerCase() === bestCounty.toLowerCase())
        nearestWithInventory = {
          county_fips: match?.fips ?? '',
          county_name: match?.name ?? bestCounty,
          live_auction_count: bestCount,
        }
      }
    } catch {
      // Best-effort only — an empty scorecard with no suggestion is still honest.
    }
  }

  const topParcel = pickTopParcel(rows)

  const layer = getLayer(layerId)
  const acsRow = ACS.counties.find((c) => c.county_fips === county.fips)
  let marketValue: number | null = null
  if (layer?.id === 'market_direction') marketValue = acsRow?.median_home_value ?? null
  if (layer?.id === 'median_income') marketValue = acsRow?.median_household_income ?? null

  const response: ScorecardResponse = {
    county_fips: county.fips,
    county_name: county.name,
    as_of: new Date().toISOString(),
    live_auction_count: liveCount,
    top_parcel: topParcel,
    nearest_with_inventory: nearestWithInventory,
    market: layer
      ? {
          layer: layer.id,
          value: layer.hasData ? marketValue : null,
          unit: layer.unit,
          source: layer.source,
          vintage: layer.vintage,
        }
      : null,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
