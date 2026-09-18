import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { AUCTION_PIN_COLUMNS, redactPinForViewer, type PinViewerClass } from '@/lib/auctions/pin-contract'
import { getCallerViewer } from '@/lib/tier/server'
import { tierAtLeast } from '@/lib/tier/rank'
import { serverError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic'

// Same no-store, retry-wrapped data-layer client as the other auction
// routes - see app/api/auctions/route.ts.
function getSupabase() {
  return getRetryingSupabaseClient()
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

// Minimum-contract payload (lib/auctions/pin-contract.ts). This route exists
// because AuctionMap was plotting whatever the browse page last fetched at
// limit=200 - a silent slice of 2,709 upcoming rows with no indication 2,509
// of them were never drawn. It started coordinates-only; the pin card then
// showed Parcel ID, Year Built, Living Area and Plaintiff blank on every pin
// click even when the row had them (2026-09-18, 130 Cypress Club Dr). Every
// column is a real column on multi_county_auctions - the same contract the
// browse list selects - and latitude/longitude are the real coordinate
// columns; centroid_lat/centroid_lng (still referenced by the phantom type in
// types/auctions.ts) do not exist on multi_county_auctions.
const SELECT_COLUMNS = AUCTION_PIN_COLUMNS

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

  // Tier-aware field release (owner decision 2026-09-18): the pin feed is a
  // conversion surface, so gated property facts are nulled at the data layer
  // for viewers below their field class - the card's "Unlock with Free" /
  // "Unlock with Investor" CTAs are never a veil over a full payload.
  const caller = await getCallerViewer()
  const viewer: PinViewerClass = tierAtLeast(caller.tierId, 'investor')
    ? 'investor'
    : caller.signedIn
      ? 'free_member'
      : 'anonymous'

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
      return serverError('auctions.map.matching', matchingResult.error)
    }

    return NextResponse.json(
      {
        data: mappable.rows.map((r) => redactPinForViewer(r, viewer)),
        returned: mappable.rows.length,
        total_mappable: mappable.total,
        total_matching: matchingResult.count ?? 0,
        from,
        to,
        county,
        sale_type: saleType,
        status_scope: statusScope,
        viewer_fields_released: viewer,
      },
      {
        headers: {
          // The payload now varies by viewer tier; a shared edge cache would
          // serve an anonymous-redacted page to an Investor or leak Investor
          // fields to anonymous. Per-viewer, never shared.
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch (err) {
    return serverError('auctions.map', err as Error)
  }
}
