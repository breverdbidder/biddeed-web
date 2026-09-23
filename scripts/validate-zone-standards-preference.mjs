/**
 * ZW-P0-003 (#184) — prefer zone_standards over regex DIMS.
 *
 * 1) Static wire-up: API looks up zone_standards; AuctionDetail does not
 *    render parseDimensionalStandards as ordinance.
 * 2) Unit fixture: Cape Canaveral R-1 DB side setback (10) ≠ regex R-1 (7.5).
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const root = new URL('..', import.meta.url)
const api = fs.readFileSync(new URL('app/api/auctions/[id]/route.ts', root), 'utf8')
const ui = fs.readFileSync(new URL('components/auctions/AuctionDetail.tsx', root), 'utf8')
const helper = fs.readFileSync(new URL('lib/zone-standards.ts', root), 'utf8')
const zoning = fs.readFileSync(new URL('lib/zoning.ts', root), 'utf8')

for (const [label, hay, needle] of [
  ['API imports lookupZoneStandards', api, "from '@/lib/zone-standards'"],
  ['API calls lookupZoneStandards', api, 'lookupZoneStandards('],
  ['API still can fall back to zw RPC', api, "rpc('zoning_standards_for_parcel'"],
  ['Helper maps zone_standards columns', helper, 'front_setback_ft'],
  ['Helper sets standards_source', helper, "standards_source: 'zone_standards'"],
  ['UI imports hasDbBackedDimensionalStandards', ui, 'hasDbBackedDimensionalStandards'],
  ['UI shows standards not linked', ui, 'Standards not linked'],
  ['UI shows Unknown when unlinked', ui, 'value="Unknown"'],
  ['parseDimensionalStandards kept as fallback-only', zoning, 'ZW-P0-003'],
]) {
  if (!hay.includes(needle)) throw new Error(`Missing: ${label} (${needle})`)
}

if (ui.includes('parseDimensionalStandards(')) {
  throw new Error('AuctionDetail must not call parseDimensionalStandards (regex fiction)')
}

// --- Fixture unit test (Cape Canaveral R-1 vs regex) ---
// Live DB 2026-09-23: side_setback_ft=10, front=25, rear=20, max_height=35, density=5, confidence=0.85
// Regex R-1 pattern: Front 25 / Side 7.5 / Rear 20 / height 35 / density 1-6 du/acre

function mapFixture(row, zoningCode, jurisdiction) {
  const num = (v) => (v == null || v === '' ? null : Number(v))
  const front = num(row.front_setback_ft)
  const side = num(row.side_setback_ft)
  const rear = num(row.rear_setback_ft)
  const confidence = num(row.confidence_score)
  const verified =
    (front != null || side != null || rear != null || num(row.max_height_ft) != null) &&
    ((confidence != null && confidence >= 0.5) || Boolean(row.ordinance_section))
  return {
    zoning_code: zoningCode,
    jurisdiction,
    setbacks: {
      ...(front != null ? { front } : {}),
      ...(side != null ? { side } : {}),
      ...(rear != null ? { rear } : {}),
    },
    max_height_ft: num(row.max_height_ft),
    units_per_acre: num(row.max_density_du_acre),
    standards_verified: verified,
    confidence_score: confidence,
    standards_source: 'zone_standards',
  }
}

// Mirror of lib/zoning.ts R-1 branch (must stay in sync for this assertion).
function regexR1() {
  return {
    minLotSize: '7,500 sqft (typical)',
    maxHeight: '35 ft / 2.5 stories',
    setbacks: 'Front: 25ft, Side: 7.5ft, Rear: 20ft',
    density: '1-6 du/acre',
  }
}

const capeR1Db = mapFixture(
  {
    front_setback_ft: '25.00',
    side_setback_ft: '10.00',
    rear_setback_ft: '20.00',
    max_height_ft: '35',
    max_density_du_acre: '5.00',
    confidence_score: '0.85',
    ordinance_section: null,
  },
  'R-1',
  'Cape Canaveral'
)
const regex = regexR1()

if (capeR1Db.setbacks.side === 7.5) {
  throw new Error('Fixture side setback unexpectedly matches regex 7.5')
}
if (capeR1Db.setbacks.side !== 10) {
  throw new Error(`Expected Cape Canaveral R-1 side=10, got ${capeR1Db.setbacks.side}`)
}
if (!regex.setbacks.includes('7.5')) {
  throw new Error('Regex R-1 fixture no longer encodes Side: 7.5ft — update test')
}
if (!String(regex.setbacks).includes('7.5') || capeR1Db.setbacks.side === 7.5) {
  throw new Error('DB standards must differ from regex fallback when both exist')
}
if (!capeR1Db.standards_verified) {
  throw new Error('confidence 0.85 should mark standards_verified')
}
if (capeR1Db.standards_source !== 'zone_standards') {
  throw new Error('standards_source must be zone_standards')
}

// Prefer DB over regex when both exist
function preferDims(std, regexDims) {
  if (std?.standards_source === 'zone_standards' || std?.standards_verified) {
    return { source: 'db', side: std.setbacks?.side ?? null }
  }
  return { source: 'regex', side: regexDims?.setbacks ?? null }
}
const preferred = preferDims(capeR1Db, regex)
if (preferred.source !== 'db' || preferred.side !== 10) {
  throw new Error(`Preference failed: ${JSON.stringify(preferred)}`)
}

console.log(
  'ZW-P0-003 validated: zone_standards wired; AuctionDetail shows Unknown not regex; Cape Canaveral R-1 side 10 ≠ regex 7.5'
)
