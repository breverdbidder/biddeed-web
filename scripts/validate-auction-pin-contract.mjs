import fs from 'node:fs'

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
const fail = (m) => { throw new Error(m) }

// ── 1. County db-key normalization (the St. Lucie "0 live auctions" bug) ──
// multi_county_auctions.county stores 'st_lucie'; the scorecard matched on
// the display name 'St. Lucie' and silently zeroed every multi-word county.
const counties = read('../lib/counties.ts')
if (!counties.includes('export function countyDbKey')) fail('lib/counties.ts must export countyDbKey')
if (!counties.includes("replace(/[-\\s.]+/g, '_')")) fail('countyDbKey must normalize dots/spaces/hyphens to underscores')

// Functional check of the mapping data against the known stored forms.
const slugRe = /\{ slug: '([a-z-]+)', name: '([^']+)', fips: '(\d{3})' \}/g
const dbKey = (v) => v.trim().toLowerCase().replace(/[-\s.]+/g, '_')
const expected = {
  'st-lucie': 'st_lucie',
  'indian-river': 'indian_river',
  'miami-dade': 'miami_dade',
  'palm-beach': 'palm_beach',
  'santa-rosa': 'santa_rosa',
  'st-johns': 'st_johns',
}
let count = 0
for (const m of counties.matchAll(slugRe)) {
  count++
  const want = expected[m[1]]
  if (want && dbKey(m[1]) !== want) fail(`countyDbKey(${m[1]}) must be ${want}`)
  // The same normalization must work from the display name too.
  if (dbKey(m[2]) !== dbKey(m[1])) fail(`slug ${m[1]} and name "${m[2]}" must normalize to the same db key`)
}
if (count !== 67) fail(`expected 67 FL_COUNTIES entries, found ${count}`)

// ── 2. Scorecard queries by db key, never by display name ────────────────
const scorecard = read('../app/api/heatmap/scorecard/route.ts')
if (scorecard.includes("ilike('county', county.name)")) fail('scorecard must not match county by display name')
if (!scorecard.includes('countyDbKey(county.slug)')) fail('scorecard must derive the query county via countyDbKey')
if (!scorecard.includes('countyDbKey(c.slug)')) fail('nearest_with_inventory must resolve counties via countyDbKey')

// ── 3. The map pin feed carries the full minimum contract ────────────────
const contract = read('../lib/auctions/pin-contract.ts')
for (const col of ['id','county','case_number','property_address','sale_type','auction_date','plaintiff','opening_bid','assessed_value','market_value','living_area_sqft','year_built','parcel_id','owner_name','cert_number','latitude','longitude']) {
  if (!contract.includes(`'${col}'`)) fail(`pin contract is missing column ${col}`)
}
const mapRoute = read('../app/api/auctions/map/route.ts')
if (!mapRoute.includes('AUCTION_PIN_COLUMNS')) fail('/api/auctions/map must select the shared pin contract columns')

// ── 4. The shared card maps type-appropriate fields and labels gaps ──────
const card = read('../components/auctions/AuctionPinCard.tsx')
if (!card.includes('Not published')) fail('missing contract values must be labelled "Not published"')
if (!card.includes('Certificate #')) fail('tax deeds must show the certificate number')
if (!card.includes('isTaxDeed')) fail('the card must branch parties by auction type')
// No unconditional Plaintiff/Defendant blanks: plaintiff renders only on the
// foreclosure branch, defendant only when a feed actually supplies one.
const plaintiffIdx = card.indexOf('label="Plaintiff"')
const taxDeedIdx = card.indexOf('isTaxDeed ? (')
if (plaintiffIdx < 0 || plaintiffIdx < taxDeedIdx) fail('Plaintiff must render only on the non-tax-deed branch')
if (!card.includes('auction.defendant ?')) fail('Defendant must render conditionally (no such column exists)')

// ── 5. Every pin surface routes through the one card and one mapper ──────
for (const [file, token] of [
  ['../components/auctions/AuctionsLayout.tsx', 'AuctionPinCard'],
  ['../components/heatmap/MapsPageClient.tsx', 'AuctionPinCard'],
  ['../components/heatmap/HomepageMapInteractive.tsx', 'AuctionPinCard'],
  ['../components/heatmap/HeatmapMap.tsx', 'onSelectPin'],
  ['../components/auctions/AuctionMap.tsx', 'pinToAuction'],
]) {
  const src = read(file)
  if (!src.includes(token)) fail(`${file} must use ${token}`)
}
const layout = read('../components/auctions/AuctionsLayout.tsx')
if (layout.includes('selectedJustValue')) fail('the inline radar modal must be fully replaced by AuctionPinCard')
const heatmap = read('../components/heatmap/HeatmapMap.tsx')
if (!heatmap.includes("map.on('click', 'auction-points'")) fail('heatmap pins must be tappable')

console.log('Auction pin contract validated: county db-key queries, minimum pin contract columns, type-appropriate shared card on /radar, /maps and homepage')
