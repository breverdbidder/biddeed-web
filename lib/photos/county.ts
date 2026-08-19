import { createClient } from '@supabase/supabase-js'
import type { PropertyRef } from './resolve'
import { resolveBcpaoPhotoUrl } from '../bcpao'

/**
 * County rung of the photo cascade, driven by public.county_appraiser_urls.
 *
 * The registry is the source of truth for which counties we may call at all.
 * photo_status carries the verdict from the 67-county sweep:
 *
 *   verified   - proven to return a real photograph
 *   no_photos  - the appraiser genuinely publishes none (12 counties, 58.6% of
 *                live inventory -- including Miami-Dade, Palm Beach, Hillsborough)
 *   blocked    - technically reachable but legally off-limits. Lee forbids
 *                commercial redistribution outright; qPublic names our crawler
 *                in robots.txt with ai-train=no. NEVER call these.
 *   needs_auth - behind a login
 *   unknown    - not yet probed
 *
 * Only 'verified' is ever called. Treating 'blocked' as merely a technical
 * state is how the previous imagery problem happened, so the check is explicit
 * and fails closed.
 *
 * A further complication the sweep surfaced: almost no county keys its photos
 * on the same identifier it publishes in auction data. Two-step counties need a
 * bespoke adapter; only Orange and Duval are directly derivable.
 */

type Registry = {
  county_slug: string
  photo_url_pattern: string | null
  photo_id_type: string | null
  photo_status: string | null
}

let registryCache: Map<string, Registry> | null = null

async function loadRegistry(): Promise<Map<string, Registry>> {
  if (registryCache) return registryCache
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase
    .from('county_appraiser_urls')
    .select('county_slug, photo_url_pattern, photo_id_type, photo_status')
  if (error || !data) return new Map()
  registryCache = new Map(data.map((r) => [r.county_slug, r as Registry]))
  return registryCache
}

/** Normalises the county value. The table holds both 'marion' and 'Marion'. */
function slug(county: string): string {
  return county.trim().toLowerCase().replace(/\s+/g, '_')
}

/**
 * Counties whose photo URL can be built from parcel_id with no network hop.
 * Everything else needs an adapter, because the appraiser keys photos on an
 * internal id that must be looked up first.
 */
const DIRECT_BUILDERS: Record<string, (parcelId: string) => string | null> = {
  // OCPA serves by PID directly. Note it 405s on HEAD -- probeImage uses GET.
  orange: (pid) => {
    const clean = pid.replace(/[^0-9]/g, '')
    if (clean.length !== 12 && clean.length !== 15) return null
    return `https://ocpaimages.ocpafl.org/api/Image/GetPIDImage?pid=${clean}`
  },
  // Duval keys on the RE number and the hyphen after digit 6 is mandatory --
  // without it the endpoint returns a constant 27,796-byte fallback.
  duval: (re) => {
    const clean = re.replace(/[^0-9]/g, '')
    if (clean.length !== 10) return null
    return `https://maps.coj.net/mappao/Default.cshtml?RE=${clean.slice(0, 6)}-${clean.slice(6)}`
  },
}

export async function tryCountyPhoto(p: PropertyRef): Promise<string | null> {
  if (!p.parcelId) return null
  const key = slug(p.county)

  const registry = await loadRegistry()
  const entry = registry.get(key)

  // Fail closed: an unknown or unprobed county is not called.
  if (!entry || entry.photo_status !== 'verified') return null

  // Brevard is the reference implementation and carries its own GIS lookup.
  if (key === 'brevard') {
    return await resolveBcpaoPhotoUrl(p.parcelId)
  }

  const direct = DIRECT_BUILDERS[key]
  if (direct) return direct(p.parcelId)

  // Verified but two-step (broward, seminole, osceola, escambia, manatee,
  // putnam). Each needs its own adapter; until one exists the cascade falls
  // through to satellite rather than guessing a URL.
  return null
}

/** Exposed for tests and for the backfill job. */
export function __resetRegistryCache() {
  registryCache = null
}
