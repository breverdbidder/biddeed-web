/**
 * ZW-P0-003 — prefer live `zone_standards` (joined via zoning_districts +
 * jurisdictions) over regex `parseDimensionalStandards` for auction dims.
 *
 * `zw_zoning_standards` / `zoning_standards_for_parcel` remain a secondary
 * path; measured 2026-09-23 that table had 0 rows, while `zone_standards`
 * had ~3,563. Do not invent columns — map only what exists on zone_standards.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ZoningStandards } from '@/types/auctions'

/** Minimum confidence to label a DB row as verified (vs linked-but-unconfirmed). */
export const ZONE_STANDARDS_VERIFIED_CONFIDENCE = 0.5

export type ZoneStandardsRow = {
  front_setback_ft: number | string | null
  side_setback_ft: number | string | null
  rear_setback_ft: number | string | null
  corner_setback_ft?: number | string | null
  max_height_ft: number | string | null
  max_stories: number | string | null
  max_far: number | string | null
  max_density_du_acre: number | string | null
  min_lot_sqft: number | string | null
  parking_per_unit: number | string | null
  parking_per_1000sf: number | string | null
  source_url: string | null
  ordinance_section: string | null
  confidence_score: number | string | null
  scraped_at: string | null
}

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Normalize jurisdiction / municipality labels for loose equality. */
export function normalizeJurisdictionKey(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\bunincorporated\b/g, ' ')
    .replace(/\bcounty\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Candidate zone codes: exact token, hyphenated, and de-hyphenated. */
export function zoneCodeCandidates(zoneCode: string | null | undefined): string[] {
  if (!zoneCode) return []
  const token = zoneCode.trim().split(/[\s,]/)[0] || ''
  if (!token) return []
  const upper = token.toUpperCase()
  const withHyphen = upper.replace(/^([A-Z]+)(\d)/, '$1-$2')
  const noHyphen = upper.replace(/-/g, '')
  return [...new Set([upper, withHyphen, noHyphen])]
}

export function zoneStandardsHasDims(row: Pick<
  ZoneStandardsRow,
  | 'front_setback_ft'
  | 'side_setback_ft'
  | 'rear_setback_ft'
  | 'max_height_ft'
  | 'max_far'
  | 'max_density_du_acre'
  | 'min_lot_sqft'
>): boolean {
  return (
    num(row.front_setback_ft) != null ||
    num(row.side_setback_ft) != null ||
    num(row.rear_setback_ft) != null ||
    num(row.max_height_ft) != null ||
    num(row.max_far) != null ||
    num(row.max_density_du_acre) != null ||
    num(row.min_lot_sqft) != null
  )
}

/**
 * Map a `zone_standards` row (+ district/jurisdiction labels) into the
 * AuctionDetail `ZoningStandards` shape. `standards_verified` is true only
 * when confidence is high enough or an ordinance citation exists — linked
 * low-confidence rows still surface as DB-sourced, never as regex estimates.
 */
export function mapZoneStandardsToZoningStandards(input: {
  row: ZoneStandardsRow
  zoningCode: string
  zoningDesc?: string | null
  jurisdiction?: string | null
  districtOrdinanceSection?: string | null
}): ZoningStandards {
  const { row, zoningCode, zoningDesc, jurisdiction, districtOrdinanceSection } = input
  const front = num(row.front_setback_ft)
  const side = num(row.side_setback_ft)
  const rear = num(row.rear_setback_ft)
  const corner = num(row.corner_setback_ft)
  const setbacks =
    front != null || side != null || rear != null || corner != null
      ? {
          ...(front != null ? { front } : {}),
          ...(side != null ? { side } : {}),
          ...(corner != null ? { side_street: corner } : {}),
          ...(rear != null ? { rear } : {}),
        }
      : null

  const spaces = num(row.parking_per_unit)
  const per1000 = num(row.parking_per_1000sf)
  const parking =
    spaces != null || per1000 != null
      ? {
          ...(spaces != null ? { spaces_per_unit: spaces } : {}),
          ...(per1000 != null ? { per_1000_sqft: per1000 } : {}),
        }
      : null

  const confidence = num(row.confidence_score)
  const citation =
    row.ordinance_section || districtOrdinanceSection || null
  const verified =
    zoneStandardsHasDims(row) &&
    ((confidence != null && confidence >= ZONE_STANDARDS_VERIFIED_CONFIDENCE) || Boolean(citation))

  return {
    zoning_code: zoningCode,
    zoning_desc: zoningDesc ?? null,
    jurisdiction: jurisdiction ?? null,
    land_use: null,
    setbacks,
    parking,
    max_height_ft: num(row.max_height_ft),
    max_stories: num(row.max_stories),
    units_per_acre: num(row.max_density_du_acre),
    far_max: num(row.max_far),
    permitted_uses: null,
    overlays: null,
    min_lot_sqft: num(row.min_lot_sqft),
    source_url: row.source_url,
    source_citation: citation,
    verified_at: row.scraped_at,
    standards_verified: verified,
    confidence_score: confidence,
    standards_source: 'zone_standards',
  }
}

type DistrictJoinRow = {
  id: number
  code: string
  name: string | null
  ordinance_section: string | null
  jurisdictions: { id: number; name: string; county: string | null } | { id: number; name: string; county: string | null }[] | null
  zone_standards: ZoneStandardsRow | ZoneStandardsRow[] | null
}

function asOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function jurisdictionMatches(
  jurName: string,
  hint: string | null | undefined,
  county: string
): boolean {
  const jurKey = normalizeJurisdictionKey(jurName)
  const countyKey = normalizeJurisdictionKey(county)
  if (!hint) {
    // Unincorporated / county-named jurisdictions when no municipality hint.
    return jurKey === countyKey || jurKey.includes(countyKey) || countyKey.includes(jurKey)
  }
  const hintKey = normalizeJurisdictionKey(hint)
  if (!hintKey) return false
  if (jurKey === hintKey) return true
  if (jurKey.includes(hintKey) || hintKey.includes(jurKey)) return true
  // assignment slug "brevard_county" vs "Unincorporated Brevard County"
  if (hintKey === countyKey && (jurKey.includes(countyKey) || jurName.toLowerCase().includes('unincorporated'))) {
    return true
  }
  return false
}

/**
 * Secondary lookup keyed by zone code + jurisdiction/county.
 * Prefers an exact jurisdiction match; falls back to a unique county+code hit.
 */
export async function lookupZoneStandards(supabase: SupabaseClient, args: {
  zoneCode: string
  county: string
  jurisdictionHint?: string | null
}): Promise<ZoningStandards | null> {
  const codes = zoneCodeCandidates(args.zoneCode)
  if (!codes.length || !args.county) return null

  const { data, error } = await supabase
    .from('zoning_districts')
    .select(`
      id,
      code,
      name,
      ordinance_section,
      jurisdictions!inner ( id, name, county ),
      zone_standards (
        front_setback_ft,
        side_setback_ft,
        rear_setback_ft,
        corner_setback_ft,
        max_height_ft,
        max_stories,
        max_far,
        max_density_du_acre,
        min_lot_sqft,
        parking_per_unit,
        parking_per_1000sf,
        source_url,
        ordinance_section,
        confidence_score,
        scraped_at
      )
    `)
    .in('code', codes)
    .ilike('jurisdictions.county', args.county)

  if (error) {
    console.error('zone_standards lookup failed', {
      county: args.county,
      zoneCode: args.zoneCode,
      error: error.message,
    })
    return null
  }

  const rows = (data || []) as DistrictJoinRow[]
  const withStandards = rows
    .map((d) => {
      const jur = asOne(d.jurisdictions)
      const zs = asOne(d.zone_standards)
      if (!jur || !zs || !zoneStandardsHasDims(zs)) return null
      return { district: d, jur, zs }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  if (!withStandards.length) return null

  const hinted = args.jurisdictionHint
    ? withStandards.filter((x) => jurisdictionMatches(x.jur.name, args.jurisdictionHint, args.county))
    : []

  let chosen = hinted[0] ?? null
  if (!chosen && !args.jurisdictionHint && withStandards.length === 1) {
    chosen = withStandards[0]
  }
  if (!chosen && args.jurisdictionHint) {
    // Hint missed — only accept an unambiguous single county+code match.
    if (withStandards.length === 1) chosen = withStandards[0]
  }
  if (!chosen && !args.jurisdictionHint) {
    const unincorporated = withStandards.filter((x) =>
      /unincorporated/i.test(x.jur.name)
    )
    if (unincorporated.length === 1) chosen = unincorporated[0]
  }
  if (!chosen) return null

  return mapZoneStandardsToZoningStandards({
    row: chosen.zs,
    zoningCode: chosen.district.code,
    zoningDesc: chosen.district.name,
    jurisdiction: chosen.jur.name,
    districtOrdinanceSection: chosen.district.ordinance_section,
  })
}

/** True when auction dims should render DB-backed standards (not regex). */
export function hasDbBackedDimensionalStandards(
  std: ZoningStandards | null | undefined
): boolean {
  if (!std) return false
  if (std.standards_source === 'zone_standards') return true
  if (std.standards_verified) return true
  return Boolean(
    std.setbacks ||
      std.max_height_ft != null ||
      std.units_per_acre != null ||
      std.far_max != null ||
      std.min_lot_sqft != null
  )
}
