import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { formatCountyLabel } from '@/lib/counties'

/**
 * Auction-day evidence preview — /preview?date=2026-09-16
 *
 * Built for the live-shopping land grab: one linkable page per auction day
 * that walks the evidence on a small set of specific, disputable deals and
 * hands the viewer a prefilled $25 SIGNAL$ report checkout. It is the page a
 * YouTube/Shorts/live stream pins while the host talks.
 *
 * This is a static route with a ?date= search param, NOT a /preview/[date]
 * dynamic segment: this OpenNext-on-Cloudflare deploy 404s dynamic page
 * segments that are not in the prerender manifest (route handlers are fine,
 * which is why /api/auctions/[id] works). /radar?view= proves the
 * static-route + search-param pattern in production. Verified live
 * 2026-09-15: /preview/2026-09-16 404'd on a green deploy while
 * /api/auctions/<uuid> returned 200.
 *
 * Data discipline (same rules as the rest of the app):
 * - Every figure shown comes from multi_county_auctions at request time.
 *   Nothing is hardcoded, nothing is estimated here.
 * - SIGNAL$ Max Bid / win probability are NOT shown — they stay withheld
 *   until the rebuilt model is validated (see ml-numbers-withheld-until-v5).
 * - Unknown renders as an em-dash, never as a fact.
 *
 * force-dynamic: auction data is live and must never be frozen in the Data
 * Cache, and middleware mints a per-request CSP nonce (see middleware.ts).
 */
export const dynamic = 'force-dynamic'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

type PreviewRow = {
  id: string
  county: string
  case_number: string
  property_address: string | null
  city: string | null
  zip: string | null
  auction_date: string | null
  auction_time: string | null
  sale_type: string
  plaintiff: string | null
  opening_bid: number | null
  judgment_amount: number | null
  assessed_value: number | null
  market_value: number | null
  property_type: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  year_built: number | null
  source_url: string | null
}

const SELECT_COLUMNS = [
  'id', 'county', 'case_number', 'property_address', 'city', 'zip',
  'auction_date', 'auction_time', 'sale_type', 'plaintiff',
  'opening_bid', 'judgment_amount', 'assessed_value', 'market_value',
  'property_type', 'beds', 'baths', 'sqft', 'year_built', 'source_url',
].join(',')

function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function fmtLongDate(iso: string): string {
  // Noon UTC avoids the date rolling back a day in US timezones.
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The scraper can hold the same case twice for one sale date (tracked
 * upstream as the 1361 Nimitz Ct 9/16 duplicate). Case numbers arrive with
 * a " (0)"-style suffix on the dupes; collapse on county + base case +
 * address and keep the row carrying more facts.
 */
function dedupe(rows: PreviewRow[]): PreviewRow[] {
  const seen = new Map<string, PreviewRow>()
  for (const row of rows) {
    const baseCase = (row.case_number || '').replace(/\s*\(\d+\)\s*$/, '')
    const key = `${row.county}|${baseCase}|${row.property_address ?? ''}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, row)
      continue
    }
    const score = (r: PreviewRow) =>
      [r.opening_bid, r.judgment_amount, r.market_value, r.beds, r.baths, r.sqft]
        .filter((v) => v != null).length
    if (score(row) > score(existing)) seen.set(key, row)
  }
  return [...seen.values()]
}

function hasPublishedAddress(row: PreviewRow): boolean {
  return Boolean(
    row.property_address &&
      !/not published/i.test(row.property_address)
  )
}

/** The dollar figure the plaintiff is asking for at the sale. */
function bankAsk(row: PreviewRow): number | null {
  return row.judgment_amount ?? row.opening_bid
}

/**
 * The disputed-deal pattern that is already pulling views on Shorts: the
 * bank's ask versus the recorded market estimate. Foreclosures where the
 * ask exceeds the estimate are the argument starters; they sort first.
 */
function pickForeclosures(rows: PreviewRow[], count: number): PreviewRow[] {
  const pool = rows.filter(
    (r) => r.sale_type === 'foreclosure' && hasPublishedAddress(r) && bankAsk(r) != null
  )
  const disputeRatio = (r: PreviewRow) => {
    const ask = bankAsk(r)
    if (ask == null || r.market_value == null || r.market_value <= 0) return 0
    return ask / r.market_value
  }
  return pool
    .sort((a, b) => {
      const ra = disputeRatio(a)
      const rb = disputeRatio(b)
      if (rb !== ra) return rb - ra
      return (bankAsk(b) ?? 0) - (bankAsk(a) ?? 0)
    })
    .slice(0, count)
}

/** Tax-deed hooks: real properties with the lowest opening bids. */
function pickTaxDeeds(rows: PreviewRow[], count: number): PreviewRow[] {
  return rows
    .filter(
      (r) => r.sale_type === 'tax_deed' && hasPublishedAddress(r) && r.opening_bid != null
    )
    .sort((a, b) => (a.opening_bid ?? 0) - (b.opening_bid ?? 0))
    .slice(0, count)
}

function buyReportHref(row: PreviewRow): string {
  const params = new URLSearchParams()
  params.set('mca_id', row.id)
  params.set('county', row.county)
  if (row.property_address) params.set('address', row.property_address)
  if (row.auction_date) params.set('date', row.auction_date)
  return `/buy-report?${params.toString()}`
}

function DealCard({
  row,
  headline,
}: {
  row: PreviewRow
  headline: string
}) {
  const ask = bankAsk(row)
  const specs = [
    row.beds != null ? `${row.beds} bd` : null,
    row.baths != null ? `${row.baths} ba` : null,
    row.sqft != null ? `${row.sqft.toLocaleString('en-US')} sqft` : null,
    row.year_built != null ? `built ${row.year_built}` : null,
  ].filter(Boolean)

  return (
    <section className="rounded-xl border border-border bg-background p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {headline} · {formatCountyLabel(row.county)} County ·{' '}
        {row.sale_type === 'tax_deed' ? 'Tax deed' : 'Foreclosure'}
      </p>
      <h2 className="font-display mt-2 text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl">
        {row.property_address}
      </h2>
      {specs.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">{specs.join(' · ')}</p>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {row.sale_type === 'tax_deed' ? 'Opening bid' : 'The bank wants'}
          </dt>
          <dd className="font-display mt-1 text-2xl font-medium text-foreground">
            {fmtMoney(ask)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Market estimate on record
          </dt>
          <dd className="font-display mt-1 text-2xl font-medium text-foreground">
            {fmtMoney(row.market_value)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Case number
          </dt>
          <dd className="mt-1 text-sm font-medium leading-6 text-foreground">
            {row.case_number}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Who is right — the ask or the estimate? The full 18-section SIGNAL$
        Property Report pulls the lien stack, comps band, and ZoneWise zoning
        for this exact parcel, with every figure traceable to a source record.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={buyReportHref(row)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Get the $25 SIGNAL$ Report for this property
        </Link>
        <Link
          href={`/radar?county=${encodeURIComponent(row.county)}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline hover:no-underline"
        >
          See it on AuctionRadar
        </Link>
      </div>
    </section>
  )
}

async function fetchDayAuctions(date: string): Promise<PreviewRow[]> {
  const supabase = getRetryingSupabaseClient(undefined, { retryMode: 'full' })
  const { data, error } = await supabase
    .from('multi_county_auctions')
    .select(SELECT_COLUMNS)
    .gte('auction_date', date)
    .lte('auction_date', date)
    .limit(1000)
  if (error || !Array.isArray(data)) return []
  return data as unknown as PreviewRow[]
}

/**
 * No valid ?date= -> land on the nearest upcoming auction day instead of a
 * bare 404, so the pinned link keeps working after the day it names passes.
 */
async function nearestAuctionDate(): Promise<string | null> {
  const supabase = getRetryingSupabaseClient(undefined, { retryMode: 'full' })
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('multi_county_auctions')
    .select('auction_date')
    .gte('auction_date', today)
    .order('auction_date', { ascending: true, nullsFirst: false })
    .limit(1)
  if (error || !Array.isArray(data) || data.length === 0) return null
  const row = data[0] as unknown as { auction_date: string | null }
  return row.auction_date
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}): Promise<Metadata> {
  const { date } = await searchParams
  const valid = Boolean(date && ISO_DATE.test(date))
  return {
    title: valid
      ? `Florida Auction Preview — ${fmtLongDate(date!)} | BidDeed.AI`
      : 'Florida Auction Preview | BidDeed.AI',
    description:
      'The evidence on the specific Florida auction deals worth arguing about: bank ask vs. recorded market estimate, lien and zoning evidence in the $25 SIGNAL$ Property Report.',
  }
}

export default async function AuctionPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: rawDate } = await searchParams
  const date = rawDate && ISO_DATE.test(rawDate) ? rawDate : await nearestAuctionDate()
  if (!date) notFound()

  const rows = dedupe(await fetchDayAuctions(date))
  if (rows.length === 0) notFound()

  const foreclosures = pickForeclosures(rows, 3)
  const taxDeeds = pickTaxDeeds(rows, 2)
  const featured = [...foreclosures, ...taxDeeds]
  const countyCount = new Set(rows.map((r) => r.county)).size
  const foreclosureCount = rows.filter((r) => r.sale_type === 'foreclosure').length
  const taxDeedCount = rows.filter((r) => r.sale_type === 'tax_deed').length

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        Auction preview
      </p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        {fmtLongDate(date)}: the deals worth arguing about.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        {rows.length.toLocaleString('en-US')} auctions across {countyCount}{' '}
        Florida {countyCount === 1 ? 'county' : 'counties'} —{' '}
        {foreclosureCount} foreclosure{foreclosureCount === 1 ? '' : 's'} and{' '}
        {taxDeedCount} tax deed{taxDeedCount === 1 ? '' : 's'}. Below are the
        specific properties where the bank&apos;s ask and the recorded market
        estimate tell two different stories. Every figure comes from county
        auction records; nothing here is a guess.
      </p>

      <div className="mt-10 flex flex-col gap-6">
        {featured.map((row, i) => (
          <DealCard key={row.id} row={row} headline={`Deal ${i + 1}`} />
        ))}
      </div>

      <section className="mt-10 rounded-xl border border-border bg-background p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium tracking-tight text-foreground">
          Every auction on the calendar, not just these five.
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The preview shows the argument starters. AuctionRadar carries the
          full {rows.length.toLocaleString('en-US')}-auction list for this
          date with map, calendar, and spreadsheet views — and the $25
          SIGNAL$ Report is the evidence pack for any one of them.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/radar"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Open AuctionRadar
          </Link>
          <Link
            href="/buy-report"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline hover:no-underline"
          >
            Buy one $25 SIGNAL$ Report
          </Link>
        </div>
      </section>

      <p className="mt-8 text-xs leading-5 text-muted-foreground">
        Opening-bid and judgment figures come from county auction records as
        scraped by BidDeed.AI. Market estimate is the value recorded in
        BidDeed auction data for the parcel. SIGNAL$ Max Bid and win
        probability figures are not shown here; they are withheld while the
        rebuilt model is validated. Auction outcomes are not guaranteed —
        do your own due diligence before bidding.
      </p>
    </div>
  )
}
