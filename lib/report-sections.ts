/**
 * The 18 sections of the SIGNAL$ Property Report, in report order — the one
 * list the checkout page, the Projects panel (S3 progressive disclosure) and
 * the generated project reports all read. Names only; values live in the
 * report engine and are released per config/report-field-release.v1.json.
 *
 * Numbering follows the render contract, public.s5_report_sections (SIGNAL-0,
 * 24 Sep 2026): §1 identification · §2-3 value · §4-7 market and comps · §8
 * transaction history · §9-10 property record and listing · §11-14 context
 * layers · §15 Bid Card · §16 judgment and encumbrance · §17 provenance ·
 * §18 outcome and scorecard. Before this, the web called §15 "Judgment" and
 * left the Bid Card out, so a buyer's "section 15" was not the report's.
 */
export const REPORT_SECTIONS = [
  'Subject and auction identification',
  'Clearing-band value estimate',
  'Market-band value estimate',
  'Auction-cleared market',
  'Market conditions',
  'Comparable sales',
  'Comparable sales statistics',
  'Transaction history',
  'Property record',
  'Listing and auction details',
  'Neighborhood context',
  'School context',
  'Flood-risk context',
  'Market grade',
  'SIGNAL$ Bid Card: opinion of price',
  'Judgment and encumbrance summary',
  'Provenance and honest limits',
  'Auction outcome and prediction scorecard',
] as const

export const REPORT_SECTION_COUNT = REPORT_SECTIONS.length
export const REPORT_PRICE_USD = 25
