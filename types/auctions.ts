/**
 * Auction row shape, matching the actual columns on multi_county_auctions.
 *
 * Ported from zonewise-web with 9 phantom fields removed: centroid_lat,
 * centroid_lng, zoning_category, fl_parcel_id, fl_co_no, just_value,
 * total_living_area, is_condo, lot_sqft. None of those are columns on
 * multi_county_auctions — Supabase returned `any`, so TypeScript never
 * caught it and the map plotted zero pins for months. The real coordinate
 * columns are latitude/longitude (populated on 1,334 of 1,418 upcoming
 * rows as of 2026-08-18).
 */
export interface Auction {
  id: number
  county: string
  case_number: string
  property_address: string | null
  auction_type: string
  auction_date: string | null
  plaintiff: string | null
  defendant?: string | null
  judgment_amount?: number | null
  assessed_value: number | null
  opening_bid: number | null
  parcel_id: string | null
  source_url: string | null
  scraped_at: string | null
  created_at: string | null
  land_value: number | null
  year_built: number | null
  owner_name: string | null
  latitude: number | null
  longitude: number | null
  photo_url: string | null
  enriched_at: string | null
  is_vacant_land: boolean
  address_status: string | null
  // Zoning intelligence fields
  dor_use_code: string | null
  zone_code: string | null
  municipality: string | null

  sale_type?: string | null
  living_area_sqft?: number | null
  lot_size?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  city?: string | null
  zip?: string | null
  property_type?: string | null
  auction_status?: string | null
  auction_url?: string | null
}

/** Enriched auction detail (from /api/auctions/[id]) */
export interface AuctionDetail extends Auction {
  bcpao_photo_url: string | null
  zoning: ZoningInfo | null
  recommendation: 'BID' | 'REVIEW' | 'SKIP' | 'UNKNOWN'
  recommendation_color: string
  max_bid: number | null
  bid_ratio: number | null
}

export interface ZoningInfo {
  dor_use_code: string | null
  dor_use_description: string | null
  zone_code: string | null
  municipality: string | null
  future_land_use: string | null
  improvement_quality: string | null
  construction_class: string | null
  last_sale_price: number | null
  last_sale_year: number | null
  homestead_value: number | null
}

/** Per-county aggregate from the SSOT summary function. */
export interface CountyDetail {
  county: string
  total: number
  upcoming: number
  next_auction_date: string | null
}

export interface AuctionSummary {
  total: number
  by_county: Record<string, number>
  by_type: Record<string, number>
  by_zoning: Record<string, number>
  with_address: number
  vacant_land: number
  condos: number
  // Added Aug 17 2026 with the SSOT summary function. Optional so any older
  // consumer of this shape keeps compiling.
  upcoming?: number
  counties?: number
  counties_upcoming?: number
  by_sale_type?: Record<string, number>
  counties_detail?: CountyDetail[]
  date_min?: string | null
  date_max?: string | null
  generated_at?: string | null
}

export interface AuctionsResponse {
  data: Auction[]
  total: number
  limit: number
  offset: number
  ignored_filters?: string[]
}

/** Per-day typed counts from /api/auctions/calendar. */
export interface AuctionCalendarDay {
  date: string
  foreclosure_count: number
  tax_deed_count: number
  other_count: number
  total: number
}

export interface AuctionCalendarResponse {
  from: string
  to: string
  county: string | null
  sale_type: string | null
  days: AuctionCalendarDay[]
  totals: {
    foreclosure_count: number
    tax_deed_count: number
    other_count: number
    total: number
    days_with_auctions: number
  }
}

export type SortField = 'auction_date' | 'county' | 'just_value' | 'property_address' | 'zoning_category'
export type SortDirection = 'asc' | 'desc'
export type ViewMode = 'table' | 'map' | 'calendar' | 'spreadsheet'
