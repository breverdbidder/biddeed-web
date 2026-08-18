import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Same no-store data-layer fetch as the other auction routes - see
      // app/api/auctions/route.ts for why this cannot be a cache-busting
      // query string instead.
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAP_ROW_CAP = 5000
// This project's PostgREST instance caps every response at 1,000 rows
// server-side regardless of what Range a client requests - the same
// truncation class documented on the old /api/auctions/summary endpoint. A
// single .limit(5000) call silently comes back with 1,000 rows and no error.
// Paginate in page-sized requests up to MAP_ROW_CAP instead of trusting a
// single limit() to be honored.
const PAGE_SIZE = 1000

// Coordinates-only payload. This route exists because AuctionMap was plotting
// whatever the browse page last fetched at limit=200 - a silent slice of
// 2,709 upcoming rows with no indication 2,509 of them were never drawn.
// latitude/longitude are the real columns; centroid_lat/centroid_lng (still
// referenced by the phantom type in types/auctions.ts) do not exist on
// multi_county_auctions.
const SELECT_COLUMNS = [
  'id',
  'latitude',
  'longitude',
  'sale_type',
  'county',
  'property_address',
  'auction_date',
  'opening_bid',
  'assessed_value',
  'market_value',
].join(',')

interface Filters {
  county: string | null
  saleType: string | null
  from: string | null
  to: string | null
  upcoming: boolean
  statusScope: string
}

// Raw auction_status values that public.auction_is_live() treats as live.
// PostgREST cannot call that function in a filter, so the list is mirrored
// here and must be kept in step with it.
//
// Case matters: .in. is case-sensitive. Verified against every distinct
// auction_status on future-dated rows (2026-08-18) - the only value stored in
// mixed case is CANCELLED, which is not live, so no live row can be missed by
// exact-case matching. A NULL or empty status normalizes to 'upcoming', hence
// the explicit is.null arm.
const LIVE_STATUSES = ['upcoming', 'active', 'scheduled']
const LIVE_STATUS_FILTER =
  `auction_status.in.(${LIVE_STATUSES.join(',')}),auction_status.is.null`

function applyFilters(query: any, f: Filters) {
  let q = query
  if (f.county) q = q.ilike('county', f.county)
  if (f.saleType) q = q.eq('sale_type', f.saleType)
  if (f.from) q = q.gte('auction_date', f.from)
  if (f.to) q = q.lte('auction_date', f.to)
  if (f.upcoming && !f.from) {
    q = q.gte('auction_date', new Date().toISOString().slice(0, 10))
  }
  // Scope to auctions somebody can actually bid on, unless explicitly asked
  // for everything. Without this the map plotted 2,369 pins for a date range
  // holding only 1,921 live auctions - 448 pins (18.9%) were redeemed,
  // cancelled, sold or still in preview. Clicking one opened a property that
  // cannot be bid on, which is the same defect fixed in the /lots feed.
  if (f.statusScope !== 'all') {
    q = q.or(LIVE_STATUS_FILTER)
  }
  return q
}

async function fetchMappable(supabase: ReturnType<typeof getSupabase>, filters: Filters) {
  const rows: Record<string, unknown>[] = []
  let total = 0

  for (let offset = 0; offset < MAP_ROW_CAP; offset += PAGE_SIZE) {
    const rangeEnd = Math.min(offset + PAGE_SIZE, MAP_ROW_CAP) - 1
    const query = applyFilters(
      supabase
        .from('multi_county_auctions')
        .select(SELECT_COLUMNS, { count: 'exact' })
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('auction_date', { ascending: true, nullsFirst: false })
        .range(offset, rangeEnd),
      filters
    )
    const { data, count, error } = await query
    if (error) throw error
    total = count ?? 0
    const page = data || []
    rows.push(...page)
    // Fewer rows than requested means this page reached the true end of the
    // matching set - no point issuing another request.
    if (page.length < rangeEnd - offset + 1) break
  }

  return { rows, total }
}

/**
 * GET /api/auctions/map?from=&to=&county=&sale_type=&upcoming=&status_scope=
 *
 * Returns THREE numbers, not two: `returned` (rows in this response),
 * `total_mappable` (rows matching the filters that have coordinates), and
 * `total_matching` (rows matching the filters, coords or not). A "showing N
 * of M mappable" banner built from only two numbers silently disappears
 * whichever rows lack coordinates in the first place - the same failure this
 * route was built to fix, in a different costume.
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)

  const county = searchParams.get('county')
  const saleType = searchParams.get('sale_type')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const upcoming = searchParams.get('upcoming') === 'true'
  const statusScope = searchParams.get('status_scope') || 'live'

  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (value && !ISO_DATE.test(value)) {
      return NextResponse.json(
        { error: `invalid ${name}: expected YYYY-MM-DD` },
        { status: 400 }
      )
    }
  }

  const filters: Filters = { county, saleType, from, to, upcoming, statusScope }

  const matchingCountQuery = applyFilters(
    supabase.from('multi_county_auctions').select('id', { count: 'exact', head: true }),
    filters
  )

  let mappable: { rows: Record<string, unknown>[]; total: number }
  try {
    const [result, matchingResult] = await Promise.all([
      fetchMappable(supabase, filters),
      matchingCountQuery,
    ])
    mappable = result

    if (matchingResult.error) {
      return NextResponse.json({ error: matchingResult.error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        data: mappable.rows,
        returned: mappable.rows.length,
        total_mappable: mappable.total,
        total_matching: matchingResult.count ?? 0,
        from,
        to,
        county,
        sale_type: saleType,
        status_scope: statusScope,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
