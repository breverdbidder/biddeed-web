import { createHash } from 'node:crypto'

import { cacheImage } from './cache'
import { tryCountyPhoto } from './county'
import { MIN_CREDIBLE_IMAGE_BYTES, matchPlaceholder } from './placeholders'

/**
 * Property imagery resolver — the cascade, and the contract the rest of
 * lib/photos is written against.
 *
 * Why this module exists: 86,216 auction records were displaying images
 * hot-linked from a competitor's S3 bucket. That is someone else's bandwidth,
 * someone else's terms, and a switch they could throw at any moment. Every
 * image we show now has to be one we resolved ourselves and stored ourselves.
 *
 * The cascade, best evidence first:
 *
 *   1. county    — the Property Appraiser's own photograph. Authoritative, and
 *                  the only rung that is an actual picture of the actual
 *                  building. Only counties marked `verified` in
 *                  public.county_appraiser_urls are ever called; `blocked`
 *                  counties are a legal boundary, not a technical one.
 *   2. satellite — Google Static Maps aerial, when we have coordinates. Always
 *                  correct, never flattering, and honest about being an aerial.
 *   3. street    — Street View, when metadata confirms a pano actually exists
 *                  at that location. The metadata endpoint is free and returns
 *                  status:"ZERO_RESULTS" rather than an image, which is the
 *                  only reliable way to avoid caching the grey "no imagery"
 *                  tile.
 *   4. none      — no image. The caller renders the placeholder SVG and says
 *                  so. An honest gap beats a wrong picture on a page someone
 *                  is about to bid money against.
 *
 * Nothing here throws. A resolver failure degrades to a later rung and finally
 * to `none`; it must never take down an auction detail page.
 */

export type PhotoSource = 'county' | 'satellite' | 'street' | 'none'

export interface PropertyRef {
  /** Auction record id, used only for logging/attribution. */
  id: string
  /** County slug or display name — normalised downstream. */
  county: string
  /** Parcel / RE / tax account number as published in auction data. */
  parcelId?: string | null
  /** Situs address, used for nothing but debugging today. */
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface ResolvedPhoto {
  /** URL to serve. Null when nothing credible was found. */
  url: string | null
  source: PhotoSource
  /** Human-readable credit line, required by both Google and the appraisers. */
  attribution: string | null
  /** Why we ended up here. Surfaced in logs, never in the UI. */
  reason: string
}

const NONE = (reason: string): ResolvedPhoto => ({
  url: null,
  source: 'none',
  attribution: null,
  reason,
})

/**
 * Fetches a candidate image and decides whether it is real.
 *
 * GET, not HEAD, deliberately: OCPA answers HEAD with 405, and more importantly
 * a status code tells us nothing here. Several appraisers answer a miss with a
 * perfectly valid 200 JPEG that reads "no photo available", so the body is the
 * only evidence that counts. Byte length and md5 are checked against the
 * signatures measured in the 67-county sweep.
 */
export async function probeImage(
  url: string
): Promise<{ ok: true; bytes: number } | { ok: false; reason: string }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'BidDeed.AI/2.0' },
    })
    if (!res.ok) return { ok: false, reason: `http ${res.status}` }

    const type = res.headers.get('content-type') || ''
    if (!type.startsWith('image/')) return { ok: false, reason: `content-type ${type || 'absent'}` }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength < MIN_CREDIBLE_IMAGE_BYTES) {
      return { ok: false, reason: `only ${buf.byteLength} bytes — spacer or error graphic` }
    }

    const hit = matchPlaceholder(buf.byteLength, createHash('md5').update(buf).digest('hex'))
    if (hit) return { ok: false, reason: `known ${hit.source} placeholder (${hit.note})` }

    return { ok: true, bytes: buf.byteLength }
  } catch (err) {
    return { ok: false, reason: `fetch failed: ${(err as Error).message}` }
  }
}

function hasCoords(p: PropertyRef): p is PropertyRef & { latitude: number; longitude: number } {
  return (
    typeof p.latitude === 'number' &&
    typeof p.longitude === 'number' &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude)
  )
}

function googleKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || null
}

/**
 * Street View only when a pano genuinely exists there.
 *
 * The image endpoint returns a grey "Sorry, we have no imagery here" tile with
 * HTTP 200 for locations it does not cover. The metadata endpoint is the fix:
 * it is free, it is not rate-limited the same way, and it says ZERO_RESULTS.
 */
async function tryStreetView(
  p: PropertyRef & { latitude: number; longitude: number },
  key: string
): Promise<string | null> {
  const at = `${p.latitude},${p.longitude}`
  try {
    const meta = await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?location=${at}&radius=50&key=${key}`,
      { signal: AbortSignal.timeout(8_000) }
    )
    if (!meta.ok) return null
    const json = (await meta.json()) as { status?: string }
    if (json.status !== 'OK') return null
  } catch {
    return null
  }
  return `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${at}&fov=75&key=${key}`
}

function trySatellite(
  p: PropertyRef & { latitude: number; longitude: number },
  key: string
): string {
  const at = `${p.latitude},${p.longitude}`
  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${at}` +
    `&zoom=19&size=640x480&maptype=satellite&markers=color:0xF59E0B%7C${at}&key=${key}`
  )
}

/**
 * Runs the cascade and returns the URL we will serve.
 *
 * `store` copies the winner into our own bucket. Callers rendering a page
 * should pass true; a dry-run audit should pass false so that probing does not
 * quietly fill storage.
 */
export async function resolvePropertyPhoto(
  p: PropertyRef,
  { store = true }: { store?: boolean } = {}
): Promise<ResolvedPhoto> {
  // 1. County appraiser.
  try {
    const countyUrl = await tryCountyPhoto(p)
    if (countyUrl) {
      const probe = await probeImage(countyUrl)
      if (probe.ok) {
        const url = store ? await cacheImage(countyUrl, p.id, 'county') : countyUrl
        return {
          url,
          source: 'county',
          attribution: `${p.county} County Property Appraiser`,
          reason: `county photo, ${probe.bytes} bytes`,
        }
      }
    }
  } catch {
    // Fall through — a county adapter must never break the page.
  }

  const key = googleKey()
  if (!hasCoords(p)) return NONE('no county photo and no coordinates')
  if (!key) return NONE('no county photo and GOOGLE_MAPS_API_KEY is unset')

  // 2. Satellite. Always available with coordinates, so it is the floor rather
  //    than a gamble — but Street View is the better picture when it exists,
  //    so try that first and fall back.
  const street = await tryStreetView(p, key)
  if (street) {
    const probe = await probeImage(street)
    if (probe.ok) {
      const url = store ? await cacheImage(street, p.id, 'street') : street
      return {
        url,
        source: 'street',
        attribution: 'Google Street View',
        reason: `street view pano, ${probe.bytes} bytes`,
      }
    }
  }

  const satellite = trySatellite(p, key)
  const probe = await probeImage(satellite)
  if (probe.ok) {
    const url = store ? await cacheImage(satellite, p.id, 'satellite') : satellite
    return {
      url,
      source: 'satellite',
      attribution: 'Google Maps aerial',
      reason: `satellite tile, ${probe.bytes} bytes`,
    }
  }

  return NONE(`every rung failed; last: ${probe.reason}`)
}
