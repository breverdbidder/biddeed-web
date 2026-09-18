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
// Owner decision 2026-09-18: "Not published" is retired - the public card is
// a conversion surface. Genuinely missing entitled values read "Not yet
// enriched", never a fabricated value.
if (card.includes('Not published')) fail('the card must not render "Not published" (owner decision 2026-09-18)')
if (!card.includes('Not yet enriched')) fail('entitled missing values must be labelled "Not yet enriched"')
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

// ── 6. Tier-aware field release (owner decision 2026-09-18) ──────────────
// Field classes must match the canonical entitlement SSOT (PLANS in
// components/deed-home/LandingSections + lib/tier): free-to-browse facts
// public; "the published number" (assessed value) and parcel ID free-member;
// plaintiff/owner/year-built/living-area/certificate/case Investor.
const releaseMatch = contract.match(/export const PIN_FIELD_RELEASE: Record<string, PinFieldClass> = \{([^}]+)\}/s)
if (!releaseMatch) fail('pin-contract must export PIN_FIELD_RELEASE')
const release = Object.fromEntries([...releaseMatch[1].matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]))
const wantRelease = {
  property_address: 'public', county: 'public', sale_type: 'public', auction_date: 'public', opening_bid: 'public',
  assessed_value: 'free_member', market_value: 'free_member', parcel_id: 'free_member',
  year_built: 'investor', living_area_sqft: 'investor', plaintiff: 'investor',
  owner_name: 'investor', cert_number: 'investor', case_number: 'investor',
}
for (const [field, cls] of Object.entries(wantRelease)) {
  if (release[field] !== cls) fail(`PIN_FIELD_RELEASE.${field} must be '${cls}' (canonical entitlements), found '${release[field]}'`)
}
// Every contract column that carries a property fact is classified - an
// unclassified fact column would fail closed to 'investor' and silently
// over-gate. id/latitude/longitude are plot mechanics, not facts.
for (const col of ['county','case_number','property_address','sale_type','auction_date','plaintiff','opening_bid','assessed_value','market_value','living_area_sqft','year_built','parcel_id','owner_name','cert_number']) {
  if (!(col in release)) fail(`PIN_FIELD_RELEASE is missing contract column ${col}`)
}
if (!contract.includes('export function redactPinForViewer')) fail('pin-contract must export redactPinForViewer (data-level gate)')

// Data-level enforcement on BOTH feeds the card can read, with per-viewer
// cache behaviour (a shared cache would leak or wrongly lock).
for (const [name, src] of [['/api/auctions/map', mapRoute], ['/api/auctions', read('../app/api/auctions/route.ts')]]) {
  if (!src.includes('redactPinForViewer')) fail(`${name} must redact gated fields via redactPinForViewer`)
  if (!src.includes('getCallerViewer')) fail(`${name} must resolve the viewer via getCallerViewer`)
  if (!src.includes('private, no-store')) fail(`${name} must be private, no-store (per-viewer payload)`)
  if (src.includes('s-maxage')) fail(`${name} must not be edge-cached across viewers`)
}

// The card's three viewer states: anonymous sees "Unlock with Free" on
// free-member fields, free members see "Unlock with Investor" on Investor
// fields, investors see values. CTAs use the canonical links.
if (!card.includes('Unlock with Free')) fail('card must offer "Unlock with Free" to anonymous viewers')
if (!card.includes('Unlock with Investor')) fail('card must offer "Unlock with Investor" for Investor-gated fields')
if (!card.includes("href: '/sign-up'")) fail('"Unlock with Free" must link to /sign-up')
if (!card.includes("'/subscribe?tier=investor'")) fail('"Unlock with Investor" must link to the canonical /subscribe?tier=investor')
if (!card.includes('/api/viewer/tier')) fail('card must resolve viewer state from /api/viewer/tier')
if (!card.includes('useViewerState')) fail('card must gate rendering by viewer state')

// Viewer endpoint exists, resolves through the tier SSOT, and is per-viewer.
const viewerRoute = read('../app/api/viewer/tier/route.ts')
if (!viewerRoute.includes('getCallerViewer')) fail('/api/viewer/tier must resolve via getCallerViewer (tier SSOT)')
if (!viewerRoute.includes('no-store')) fail('/api/viewer/tier must be no-store')

// Tier ids stay canonical (no invented tiers): free/investor/pro/proplus/enterprise.
const rank = read('../lib/tier/rank.ts')
for (const t of ['free', 'investor', 'pro', 'proplus', 'enterprise']) {
  if (!rank.includes(`${t}:`)) fail(`lib/tier/rank.ts must keep canonical tier id ${t}`)
}
// Investor price label comes from PLANS, never a literal.
if (!card.includes("PLANS.find((p) => p.name === 'Investor')")) fail('Investor price label must come from PLANS (pricing SSOT)')

console.log('auction pin contract: all gates pass')
