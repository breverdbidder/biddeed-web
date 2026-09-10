/**
 * Florida statutory framework for judicial foreclosure sales (F.S. Ch. 45)
 * and tax deed sales (F.S. Ch. 197). This is STATE law -- it applies
 * uniformly across all 67 counties, so it is intentionally not
 * county-specific. Per-county differentiation on /counties pages comes from
 * live SSOT auction data (lib/countyAuctionData.ts), not from this file.
 *
 * Every figure below was checked against the live statute text at
 * leg.state.fl.us on 2026-09-04 (not recalled from training data) --
 * citations are inline so a reader (or a future editor) can verify directly.
 * This is legal-adjacent copy for a live SEO surface; a licensed FL attorney
 * review is recommended before this is treated as advice rather than
 * educational content, and the pages carry a disclaimer link accordingly.
 */

export const SALE_TYPES = ['foreclosure', 'tax-deed'] as const
export type SaleTypeSlug = (typeof SALE_TYPES)[number]

export interface SaleTypeLegal {
  slug: SaleTypeSlug
  label: string
  statuteChapter: string
  howItRuns: string
  deposit: string
  whatSurvives: string
  redemption: string
}

export const SALE_TYPE_LEGAL: Record<SaleTypeSlug, SaleTypeLegal> = {
  foreclosure: {
    slug: 'foreclosure',
    label: 'Foreclosure Auction',
    statuteChapter: 'Fla. Stat. Ch. 45',
    howItRuns:
      "A judicial foreclosure sale is run by the county clerk of court under a final judgment, typically on the county's online auction platform. The property is sold to the highest bidder at a public sale on the date set in the judgment.",
    deposit:
      'The high bidder must post a deposit with the clerk at the time of the sale equal to 5% of the final bid (Fla. Stat. §45.031(3)). The deposit is applied to the purchase price; the balance is due within the timeframe set by the court’s order of sale.',
    whatSurvives:
      'A foreclosure sale extinguishes the foreclosed lien and any junior liens or interests recorded after it -- but it does NOT wipe liens senior to the foreclosed mortgage, and it does NOT wipe property tax liens. Ad valorem tax liens carry statutory priority over a mortgage regardless of recording date (Fla. Stat. §197.122), so unpaid property taxes can survive a foreclosure sale and become the buyer’s obligation. Always confirm the tax status on a parcel before bidding.',
    redemption:
      'The prior owner (mortgagor) may redeem -- cure the debt and stop the sale -- at any time before the later of the clerk filing the certificate of sale or the deadline stated in the foreclosure judgment (Fla. Stat. §45.0315). Once the certificate of sale is filed, the redemption window closes.',
  },
  'tax-deed': {
    slug: 'tax-deed',
    label: 'Tax Deed Sale',
    statuteChapter: 'Fla. Stat. Ch. 197',
    howItRuns:
      "A tax deed sale is triggered when a tax certificate holder applies for a deed after the statutory holding period. The county clerk auctions the property publicly, typically on the county's online tax-deed platform, to the highest bidder.",
    deposit:
      'The successful bidder must post a nonrefundable deposit at the time of the sale equal to 5% of the bid or $200, whichever is greater (Fla. Stat. §197.542(2)). Full payment, plus documentary stamp tax and recording fees, is due within 24 hours (excluding weekends and legal holidays) or the clerk cancels the bid.',
    whatSurvives:
      'A tax deed conveys title free and clear of essentially all prior liens, mortgages, and other recorded interests -- the statute lists a single carve-out for unsatisfied liens of record held by a governmental unit, special district, or community development district (Fla. Stat. §197.552). In practice this means a tax deed sale wipes out an existing mortgage; the incumbent lender does not survive the sale.',
    redemption:
      'Any person with a legal interest -- the owner, a mortgage holder, a lienholder -- may redeem the underlying tax certificate at any time after it is issued and before the tax deed itself is issued by the clerk (Fla. Stat. §197.472). Redemption is possible right up until the deed is issued, even after the auction has produced a winning bid.',
  },
}

export const GENERAL_FAQ = [
  {
    q: 'What is the difference between a foreclosure auction and a tax deed sale in Florida?',
    a: 'A foreclosure auction (Fla. Stat. Ch. 45) sells a property to satisfy a mortgage or other lien judgment and does not wipe senior liens or property tax liens. A tax deed sale (Fla. Stat. Ch. 197) sells a property for unpaid property taxes and conveys title free of essentially all prior liens, including mortgages, with one narrow exception for certain governmental liens.',
  },
  {
    q: 'Can I bid on a Florida county auction from out of state or outside the US?',
    a: 'Yes. Florida county clerks run these as public online auctions open to any registered bidder able to meet the deposit and payment requirements -- there is no Florida residency requirement to bid.',
  },
  {
    q: 'What happens to surplus funds after a Florida auction sale?',
    a: 'If a property sells for more than what is owed to the foreclosing party (foreclosure) or the certificate holder plus costs (tax deed), the excess becomes surplus funds held by the clerk, which the prior owner or other parties with a recorded interest can claim through the clerk’s surplus funds process.',
  },
] as const
