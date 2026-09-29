/**
 * Whether /buy-report may offer checkout for a deep-linked property.
 *
 * The storefront sells a report only for the auctions /buy-report/auctions
 * lists (Gold Standard county with a confirmed county number, upcoming,
 * clerk-matched, not redeemed), and /buy-report/checkout refuses the rest.
 * A deep link (?mca_id= from a chat property card, the map scorecard or
 * /preview; ?case=&county= from /deal pages) used to go straight to the email
 * form for any property, so a visitor could type their email and only then be
 * refused at the pay step. Measured 28 Sep 2026: /buy-report?mca_id=<a Collier
 * tax deed>&county=collier showed "Get my SIGNAL$ Property Report - $25" for a
 * county the storefront does not sell. The same issue was fixed for the county
 * picker on 10 Sep (#20209); this closes the deep-link path.
 *
 * No imports, so scripts/validate-buy-report-offer.mts runs it under plain node.
 */
export type OfferRow = {
  case_number: string
  property_address: string | null
  auction_date: string | null
  opening_bid: number | null
  sale_type: string | null
}

export type Offer =
  | { state: 'sellable'; row: OfferRow }
  | { state: 'other_auctions'; rows: OfferRow[] }
  | { state: 'county_not_sold' }
  | { state: 'unknown' }

export function countySlug(raw: string | null | undefined): string {
  return (raw || '').trim().toLowerCase().replace(/[-\s]+/g, '_')
}

export function countyDisplay(slug: string): string {
  return slug
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * One /buy-report/auctions request per county per page, shared by every card
 * that asks (the map opens many pin cards in one visit). A failed or malformed
 * answer is not kept, so the next card open asks again, and answers null.
 */
export function createListingCache(fetchListing: (slug: string) => Promise<unknown>): (county: string | null | undefined) => Promise<unknown> {
  const cache = new Map<string, Promise<unknown>>()
  return (county) => {
    const slug = countySlug(county)
    if (!slug) return Promise.resolve(null)
    let pending = cache.get(slug)
    if (!pending) {
      pending = fetchListing(slug).then(
        (v) => {
          if (!Array.isArray(v)) cache.delete(slug)
          return Array.isArray(v) ? v : null
        },
        () => {
          cache.delete(slug)
          return null
        }
      )
      cache.set(slug, pending)
    }
    return pending
  }
}

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => (v || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
  return Boolean(norm(a)) && norm(a) === norm(b)
}

/**
 * Whether one auction is in the county listing. The map card knows the
 * auction's id, address and date for every viewer, but its case number only
 * for Investor and above (redacted server-side), so the match is by id when
 * the listing carries one, else by case number, else by address on the same
 * sale date.
 */
export function listedFor(
  listing: unknown,
  a: { id?: string | null; case_number?: string | null; property_address?: string | null; auction_date?: string | null }
): boolean {
  if (!Array.isArray(listing)) return false
  const day = (a.auction_date || '').slice(0, 10)
  return listing.some((r: (OfferRow & { id?: string | null }) | null) => {
    if (!r || typeof r !== 'object') return false
    const rDay = (r.auction_date || '').slice(0, 10)
    if (r.id && a.id) return r.id === a.id
    if (a.case_number && typeof r.case_number === 'string') {
      return r.case_number.trim().toLowerCase() === a.case_number.trim().toLowerCase() && (!day || !rDay || rDay === day)
    }
    return Boolean(day) && rDay === day && sameAddress(r.property_address, a.property_address)
  })
}

/** The /buy-report deep link for one auction (the page re-checks it before checkout). */
export function reportLink(a: { id: string; county: string | null; property_address?: string | null; auction_date?: string | null }): string {
  const q = new URLSearchParams({ mca_id: a.id, county: countySlug(a.county) })
  if (a.property_address) q.set('address', a.property_address)
  if (a.auction_date) q.set('date', String(a.auction_date).slice(0, 10))
  return `/buy-report?${q.toString()}`
}

/**
 * `listing` is the /buy-report/auctions answer for the property's county, or
 * null when that request failed. A failed request answers 'unknown': the page
 * keeps the checkout it showed before this check, and the server still refuses
 * a case it does not sell.
 */
export function decideOffer(listing: unknown, caseNumber: string | null | undefined, auctionDate?: string | null): Offer {
  if (!Array.isArray(listing)) return { state: 'unknown' }
  const rows = listing.filter((r): r is OfferRow => Boolean(r && typeof (r as OfferRow).case_number === 'string'))
  if (rows.length === 0) return { state: 'county_not_sold' }
  const want = (caseNumber || '').trim().toLowerCase()
  const day = (auctionDate || '').slice(0, 10)
  const same = want ? rows.filter((r) => r.case_number.trim().toLowerCase() === want) : []
  const hit = (day && same.find((r) => (r.auction_date || '').slice(0, 10) === day)) || same[0]
  return hit ? { state: 'sellable', row: hit } : { state: 'other_auctions', rows }
}
