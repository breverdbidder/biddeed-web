/**
 * Official county sale-preview link for rows that carry no source_url.
 *
 * Scope is deliberately narrow: Brevard foreclosure sales only. The Brevard
 * RealForeclose preview URL pattern is the one confirmed against the county
 * site; other counties are left null until their pattern is confirmed.
 * The link opens that sale date's county preview page, not a row-level deep
 * link, and an existing source_url always wins.
 */
type SourceRow = {
  county?: string | null
  sale_type?: string | null
  auction_type?: string | null
  auction_date?: string | null
  source_url?: string | null
}

const BREVARD_PREVIEW = 'https://brevard.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE='

export function officialSourceUrl(row: SourceRow): string | null {
  if (row.source_url) return row.source_url
  if ((row.county ?? '').trim().toLowerCase() !== 'brevard') return null
  const type = (row.sale_type ?? row.auction_type ?? '').trim().toLowerCase()
  if (type !== 'foreclosure') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(row.auction_date ?? '')
  if (!m) return null
  return `${BREVARD_PREVIEW}${m[2]}/${m[3]}/${m[1]}`
}
