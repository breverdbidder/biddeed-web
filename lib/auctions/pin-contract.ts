import type { Auction } from '@/types/auctions'

/**
 * The canonical minimum property-detail contract every auction pin must
 * carry, whichever surface plots it (/radar, /maps, homepage). Owner
 * decision 2026-09-18: "The pin from the home page should give this minimum
 * data as well for each property."
 *
 * Every column here is a real column on multi_county_auctions - the same set
 * app/api/auctions/route.ts already selects for the browse list. Before this
 * contract existed, /api/auctions/map selected coordinates plus a handful of
 * display fields, and AuctionMap.toAuctionShape() filled the rest with null.
 * A pin click therefore opened the detail card with Parcel ID, Year Built,
 * Living Area and Plaintiff permanently blank even when the underlying row
 * had them (measured live 2026-09-18 on ec83c34f, 130 Cypress Club Dr,
 * Broward tax deed: parcel_id '494212-AH-0730' existed in the list payload
 * and was blank on the card).
 */
export const AUCTION_PIN_COLUMNS = [
  'id',
  'county',
  'case_number',
  'property_address',
  'sale_type',
  'auction_date',
  'plaintiff',
  'opening_bid',
  'assessed_value',
  'market_value',
  'living_area_sqft',
  'year_built',
  'parcel_id',
  'owner_name',
  'cert_number',
  'latitude',
  'longitude',
].join(',')

/** One pin row as returned by GET /api/auctions/map. */
export interface AuctionPin {
  id: string
  county: string
  case_number: string | null
  property_address: string | null
  sale_type: string | null
  auction_date: string | null
  plaintiff: string | null
  opening_bid: number | null
  assessed_value: number | null
  market_value: number | null
  living_area_sqft: number | null
  year_built: number | null
  parcel_id: string | null
  owner_name: string | null
  cert_number: string | null
  latitude: number
  longitude: number
}

/**
 * Shape a pin row into the Auction the shared detail card renders. Fields
 * the pin feed genuinely does not carry stay null - an unknown renders as
 * "Not published", never as an invented value (the same rule
 * app/api/auctions/route.ts mapRow() follows for is_vacant_land).
 */
export function pinToAuction(p: AuctionPin): Auction {
  return {
    id: p.id,
    county: p.county,
    case_number: p.case_number ?? '',
    property_address: p.property_address,
    auction_type: p.sale_type || '',
    auction_date: p.auction_date,
    plaintiff: p.plaintiff,
    assessed_value: p.assessed_value,
    market_value: p.market_value,
    opening_bid: p.opening_bid,
    parcel_id: p.parcel_id,
    source_url: null,
    scraped_at: null,
    created_at: null,
    year_built: p.year_built,
    owner_name: p.owner_name,
    latitude: p.latitude,
    longitude: p.longitude,
    photo_url: null,
    is_vacant_land: null,
    sale_type: p.sale_type,
    living_area_sqft: p.living_area_sqft,
    cert_number: p.cert_number,
  }
}
