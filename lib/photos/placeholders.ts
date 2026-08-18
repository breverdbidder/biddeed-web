/**
 * Known "no image" responses that arrive as HTTP 200 with a real image body.
 *
 * This is the trap in the whole photo pipeline. A status check is not enough:
 * several Property Appraisers answer a miss with a valid JPEG/PNG saying
 * "no photo available", so a naive resolver happily caches a grey box and
 * ships it to a paying customer. Every entry below was measured during the
 * 67-county sweep on 2026-08-18, not guessed.
 *
 * Matching is by exact byte length first (cheap) and md5 second (certain).
 * Length alone would be too aggressive -- real photos can coincidentally share
 * a size -- so a length hit only triggers the hash comparison.
 */
export interface PlaceholderSignature {
  bytes: number
  md5?: string
  source: string
  note: string
}

export const KNOWN_PLACEHOLDERS: PlaceholderSignature[] = [
  {
    bytes: 42912,
    md5: '9eefdaccc350bfecc58fb8d0776d5e65',
    source: 'orange',
    note: 'OCPA GetPIDImage returns this grey placeholder for any unknown pid. 32% of sampled parcels hit it.',
  },
  {
    bytes: 116124,
    md5: 'a381411f7fc54d34ed71d6c0a3eb3e8f',
    source: 'pinellas',
    note: '"Sketch Unavailable". Also note the endpoint returns a building footprint, never a photograph.',
  },
  {
    bytes: 27796,
    source: 'duval',
    note: 'Constant fallback returned when the RE number is missing its mandatory hyphen after digit 6.',
  },
]

/** Anything smaller than this is a spacer, an error graphic or a tracking pixel. */
export const MIN_CREDIBLE_IMAGE_BYTES = 6_000

export function matchPlaceholder(
  bytes: number,
  md5: string | null
): PlaceholderSignature | null {
  for (const p of KNOWN_PLACEHOLDERS) {
    if (p.bytes !== bytes) continue
    // Length matched. If we recorded a hash, it must also match -- otherwise we
    // would reject a genuine photo that happens to be the same size.
    if (p.md5 && md5 && p.md5 !== md5) continue
    return p
  }
  return null
}
