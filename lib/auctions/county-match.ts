/**
 * multi_county_auctions.county is stored lowercase ('brevard'; 14,245 rows, no
 * 'Brevard' variant), so a strict === 'Brevard' never matched. Compare on the
 * stored-form key (same normalization as countyDbKey in lib/counties.ts) so a
 * display-name value also matches.
 */
export function isBrevard(county: unknown): boolean {
  return typeof county === 'string' && county.trim().toLowerCase().replace(/[-\s.]+/g, '_') === 'brevard'
}
