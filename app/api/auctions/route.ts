import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Next's App Router caches fetch() by default and supabase-js goes
      // through fetch, so query results get frozen in the Data Cache.
      // Auction data is live; it is never cached at the data layer.
      // Edge caching stays with Cache-Control.
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Only the columns the auction surfaces actually render. select('*') pulls
// all 130+ columns of multi_county_auctions — roughly 3.4 KB per row.
const SELECT_COLUMNS = [
  'id', 'county', 'case_number', 'property_address', 'city', 'zip',
  'auction_date', 'auction_time', 'sale_type', 'auction_type', 'auction_status',
  'plaintiff', 'opening_bid', 'judgment_amount', 'assessed_value',
  'market_value', 'property_type', 'beds', 'baths', 'sqft',
  'living_area_sqft', 'lot_size', 'year_built', 'parcel_id', 'owner_name',
  'latitude', 'longitude', 'photo_url', 'auction_url', 'source_url',
  'cert_number', 'redemption_deadline', 'sold_amount', 'winning_bidder',
].join(',')

/**
 * Ported from zonewise-web with the phantom-column shim removed —
 * centroid_lat/centroid_lng/just_value/total_living_area are not columns on
 * multi_county_auctions and are not in types/auctions.ts here. is_vacant_land
 * stays null (not false) when property_type is unknown, per the "unknown is
 * an em-dash, never a fact" rule.
 */
function mapRow(r: Record<string, unknown>) {
  return {
    ...r,
    auction_type: r.auction_type ?? r.sale_type,
    is_vacant_land: r.property_type == null ? null : r.property_type === 'vacant_land',
  }
}

/**
 * Auction browse endpoint.
 *
 * Aggregate counts do NOT belong here — use /api/auctions/calendar or
 * /api/auctions/summary, both backed by the SSOT functions that biddeed.ai
 * and zonewise.ai both call, so the two sites cannot disagree.
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)

  const county = searchParams.get('county')
  const type = searchParams.get('type')
  // sale_type is the reliably-populated column (foreclosure/tax_deed).
  // auction_type is NULL on many rows, so filtering on it silently drops
  // real auctions. Prefer sale_type in every new caller.
  const saleType = searchParams.get('sale_type')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')
  const hasCoords = searchParams.get('has_coords')
  const caseNumber = searchParams.get('case_number')
  const address = searchParams.get('address')

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const upcoming = searchParams.get('upcoming') === 'true'
  const order = searchParams.get('order')

  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (value && !ISO_DATE.test(value)) {
      return NextResponse.json(
        { error: `invalid ${name}: expected YYYY-MM-DD` },
        { status: 400 }
      )
    }
  }

  const ignored: string[] = []
  if (searchParams.get('zoning_category')) ignored.push('zoning_category')

  // Ascending is the useful order once a date scope is active ("what is coming
  // up"). Unscoped requests keep the historical DESC default so existing
  // callers do not change behaviour.
  const dateScoped = Boolean(from || to || upcoming)
  const ascending = order ? order === 'asc' : dateScoped

  let query = supabase
    .from('multi_county_auctions')
    .select(SELECT_COLUMNS, { count: 'exact' })
    .order('auction_date', { ascending, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (county) query = query.ilike('county', county)
  if (type) query = query.eq('auction_type', type)
  if (saleType) query = query.eq('sale_type', saleType)
  if (from) query = query.gte('auction_date', from)
  if (to) query = query.lte('auction_date', to)
  if (upcoming && !from) {
    query = query.gte('auction_date', new Date().toISOString().slice(0, 10))
  }
  if (hasCoords === 'true') {
    query = query.not('latitude', 'is', null).not('longitude', 'is', null)
  }
  if (caseNumber) query = query.ilike('case_number', `%${caseNumber}%`)
  if (address) query = query.ilike('property_address', `%${address}%`)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      data: (data || []).map((r) => mapRow(r as unknown as Record<string, unknown>)),
      total: count,
      limit,
      offset,
      ...(ignored.length ? { ignored_filters: ignored } : {}),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}
