import type { Granularity } from './config'

export interface CountyAcsRow {
  geo_id: string
  county_fips: string
  name: string
  median_home_value: number | null
  median_home_value_moe: number | null
  median_household_income: number | null
  median_household_income_moe: number | null
  population: number | null
}

export interface CountyAcsDataset {
  source: string
  tables: Record<string, string>
  release_id: string
  release_name: string
  vintage: string
  vintage_label: string
  fetched_at: string
  geography_level: 'county'
  state: 'FL'
  counties: CountyAcsRow[]
  statewide: {
    geo_id: string
    name: string
    median_home_value: number | null
    median_home_value_moe: number | null
    median_household_income: number | null
    median_household_income_moe: number | null
    population: number | null
  }
}

/** Shareable map state — encoded into the URL so a link reproduces the exact view. */
export interface HeatmapUrlState {
  layer: string
  granularity: Granularity
  /** County FIPS (3-digit) or ZCTA5, depending on granularity. */
  selected: string | null
}

export interface TopParcel {
  id: string
  property_address: string | null
  auction_date: string | null
  sale_type: string | null
  opening_bid: number | null
  market_value: number | null
  recommendation: string
  county: string
}

export interface ScorecardResponse {
  county_fips: string
  county_name: string
  as_of: string
  live_auction_count: number
  top_parcel: TopParcel | null
  /** Set when the county has zero live inventory — the nearest county with inventory, never a fabricated parcel. */
  nearest_with_inventory: { county_fips: string; county_name: string; live_auction_count: number } | null
  market: {
    layer: string
    value: number | null
    unit: string
    source: string
    vintage: string
  } | null
}
