import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import type { PhotoSource } from './resolve'

/**
 * Copies a resolved image into our own storage and returns the URL we serve.
 *
 * Caching is not a performance nicety here, it is what makes the pipeline
 * legitimate and durable:
 *
 * - Street View's terms limit how long results may be retained; caching to a
 *   known bucket with a known key is what makes that limit auditable instead of
 *   accidental.
 * - Appraiser sites are small government hosts. Several publish crawl-delays and
 *   one returns "HTTP/1.1 999 No Hacking" to unfamiliar traffic. Fetching a
 *   parcel image once rather than once per page view is the difference between
 *   a good citizen and a blocked IP.
 * - It removes the runtime dependency on a third party for the most visible
 *   element of the product. The reason this module exists at all is that 86,216
 *   images were being hot-linked from a competitor's S3 bucket, and they could
 *   have switched them off at any moment.
 *
 * Object key is content-addressed by source URL, so re-resolving the same parcel
 * is idempotent and two parcels sharing an image store it once.
 */

const BUCKET = 'parcel-imagery'

function objectKey(sourceUrl: string, source: PhotoSource): string {
  const digest = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 32)
  return `${source}/${digest.slice(0, 2)}/${digest}.jpg`
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to cache imagery')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

export function publicUrlFor(key: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

/**
 * Fetches the source image and stores it. Returns the URL to serve.
 *
 * On any failure it returns the source URL unchanged rather than throwing --
 * a caching problem should degrade to a slower page, never to a broken one.
 * Callers that must not hot-link should check the returned host.
 */
export async function cacheImage(
  sourceUrl: string,
  _propertyId: string,
  source: PhotoSource
): Promise<string> {
  const key = objectKey(sourceUrl, source)
  const supabase = admin()

  // Already stored? Storage has no cheap HEAD, so list the exact prefix.
  const dir = key.slice(0, key.lastIndexOf('/'))
  const name = key.slice(key.lastIndexOf('/') + 1)
  const { data: existing } = await supabase.storage.from(BUCKET).list(dir, { search: name, limit: 1 })
  if (existing && existing.length > 0) return publicUrlFor(key)

  let body: Buffer
  let contentType = 'image/jpeg'
  try {
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'BidDeed.AI/2.0' },
    })
    if (!res.ok) return sourceUrl
    contentType = res.headers.get('content-type') || contentType
    body = Buffer.from(await res.arrayBuffer())
  } catch {
    return sourceUrl
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, body, { contentType, upsert: true, cacheControl: '31536000' })

  if (error) return sourceUrl
  return publicUrlFor(key)
}
