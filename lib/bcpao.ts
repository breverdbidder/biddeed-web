const BCPAO_GIS_URL =
  'https://gis.brevardfl.gov/gissrv/rest/services/Base_Map/Parcel_New_WKID2881/MapServer/5/query'
const GIS_USER_AGENT = 'BidDeed.AI/2.0'
const GIS_TIMEOUT_MS = 10_000

/**
 * Returns true if parcel_id is all digits (already a BCPAO TaxAcct number).
 */
export function isTaxAcctFormat(parcelId: string): boolean {
  return /^\d+$/.test(parcelId.trim())
}

/**
 * Build BCPAO photo URL from a TaxAcct number.
 * Pattern: https://www.bcpao.us/photos/{first2digits}/{taxAcct}011.jpg
 */
export function buildBcpaoPhotoUrl(taxAcct: string): string {
  const prefix = taxAcct.substring(0, 2)
  return `https://www.bcpao.us/photos/${prefix}/${taxAcct}011.jpg`
}

/**
 * Query Brevard County GIS Layer 5 to resolve a DOR-format parcel_id to a TaxAcct.
 * Example: "24 3632-54-*-49" → 3018402
 */
export async function lookupTaxAcctFromGis(dorParcelId: string): Promise<string | null> {
  // Sanitize: only allow safe chars for ArcGIS where clause
  const sanitized = dorParcelId.replace(/[^0-9A-Za-z \-*.]/g, '')
  if (!sanitized) return null

  const params = new URLSearchParams({
    where: `PARCEL_ID='${sanitized}'`,
    outFields: 'TaxAcct',
    returnGeometry: 'false',
    f: 'json',
    resultRecordCount: '1',
  })

  try {
    const response = await fetch(`${BCPAO_GIS_URL}?${params}`, {
      headers: { 'User-Agent': GIS_USER_AGENT },
      signal: AbortSignal.timeout(GIS_TIMEOUT_MS),
    })
    if (!response.ok) return null

    const data = await response.json()
    const features = data?.features
    if (!Array.isArray(features) || features.length === 0) return null

    const taxAcct = features[0]?.attributes?.TaxAcct
    return taxAcct != null ? String(taxAcct) : null
  } catch {
    return null
  }
}

/**
 * Resolve a Brevard County parcel_id to a BCPAO photo URL.
 * - Pure digits (TaxAcct format): build URL directly, no API call.
 * - DOR format (spaces/dashes/asterisks): query GIS for TaxAcct, then build URL.
 * Returns null if lookup fails (graceful degradation).
 */
export async function resolveBcpaoPhotoUrl(parcelId: string): Promise<string | null> {
  if (!parcelId) return null

  // TaxAcct format — use directly
  if (isTaxAcctFormat(parcelId)) {
    const trimmed = parcelId.trim()
    if (trimmed.length < 4) return null
    return buildBcpaoPhotoUrl(trimmed)
  }

  // DOR format — GIS lookup required
  const taxAcct = await lookupTaxAcctFromGis(parcelId)
  if (!taxAcct) return null
  return buildBcpaoPhotoUrl(taxAcct)
}
