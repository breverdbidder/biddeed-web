import type { Metadata } from 'next'
import AuctionsLayout from '@/components/auctions/AuctionsLayout'
import type { ViewMode } from '@/types/auctions'

/**
 * The auctions workspace.
 *
 * It lives at /radar, not /auctions. GET /auctions is a JSON API on the
 * Cloudflare Worker; now that basePath is gone, an app route of that name
 * would shadow it at the apex and start returning HTML to every API client.
 * Nothing in this app may claim /auctions.
 *
 * force-dynamic: middleware mints a per-request CSP nonce and Next reads it
 * off the incoming request's content-security-policy header. Prerendered HTML
 * is built before middleware runs, so under 'strict-dynamic' its scripts are
 * all refused and the page paints blank. See middleware.ts.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AuctionRadar — BidDeed.AI',
  description:
    'Live Florida foreclosure and tax deed auctions: map, calendar, table and spreadsheet views across 67 counties.',
}

const VIEWS: ViewMode[] = ['split', 'table', 'map', 'calendar', 'spreadsheet']

const SALE_TYPES = ['foreclosure', 'tax_deed']

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; county?: string; sale_type?: string }>
}) {
  const { view, county, sale_type: saleType } = await searchParams
  // ?view= is what the Calendar nav item points at, so the sidebar and the
  // workspace's own switcher stay in agreement.
  // Map is the default surface: a bidder landing on the workspace should see
  // WHERE the inventory is before anything else.
  //
  // This line is the REAL default. AuctionsLayout has its own `initialView ??`
  // fallback, but this page always passes an explicit value, so that fallback is
  // dead code and changing it alone does nothing - verified 2026-08-20 by
  // changing it and watching /radar still render the split view.
  const initialView = VIEWS.includes(view as ViewMode) ? (view as ViewMode) : 'map'

  // ?county= and ?sale_type= make a filtered workspace linkable, and they are
  // the surface Deed acts through: its apply-county-filter tool navigates
  // here rather than reaching into another component's state.
  //
  // Both are normalised and allow-listed before they reach a query. A county
  // slug is [a-z0-9_] only; anything else is dropped rather than passed down
  // to /api/auctions, and sale_type must be one of the two real values.
  const initialCounty =
    county && /^[a-z0-9_]{2,40}$/.test(county.toLowerCase().replace(/[-\s]+/g, '_'))
      ? county.toLowerCase().replace(/[-\s]+/g, '_')
      : ''
  const initialSaleType = SALE_TYPES.includes(saleType ?? '') ? saleType : ''

  return (
    <AuctionsLayout
      initialView={initialView}
      initialCounty={initialCounty}
      initialSaleType={initialSaleType}
    />
  )
}
