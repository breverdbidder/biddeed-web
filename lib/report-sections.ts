/**
 * The 18 sections of the SIGNAL$ Property Report, in report order — the one
 * list the checkout page, the Projects panel (S3 progressive disclosure) and
 * the generated project reports all read. Names only; values live in the
 * report engine and are released per config/report-field-release.v1.json.
 */
export const REPORT_SECTIONS = [
  'Subject property identification',
  'Clearing-band value estimate',
  'Market-band value estimate',
  'Comparable sales layer',
  'Comparable quality and confidence',
  'Comparable distance analysis',
  'Comparable timing and market fit',
  'Transaction history',
  'Property record',
  'Listing and auction details',
  'Neighborhood context',
  'School context',
  'Flood-risk context',
  'Market context',
  'Judgment and encumbrance review',
  'Provenance and methodology',
  'Auction outcome tracking',
  'Prediction scorecard and max-bid decision',
] as const

export const REPORT_SECTION_COUNT = REPORT_SECTIONS.length
export const REPORT_PRICE_USD = 25
