import { getRetryingSupabaseClient } from '@/lib/supabase-retry'

import type { Brief, BriefBrand } from './types'
import { brandFromOrg, DEFAULT_BRAND } from './view'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type LoadedBrief = { brief: Brief; brand: BriefBrand; created_at: string }

/**
 * Reads one saved brief by its unguessable id (service role, server only). The
 * link is the capability: ids are random v4 UUIDs, the page is noindex, and nothing
 * lists briefs across orgs. A missing table, a bad id and a missing row all read as null.
 */
export async function loadBrief(id: string): Promise<LoadedBrief | null> {
  if (!UUID_RE.test(id)) return null
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  try {
    const supabase = getRetryingSupabaseClient(key)
    const { data, error } = await supabase.from('investment_briefs').select('brief, org_id, created_at').eq('id', id).maybeSingle()
    if (error || !data || !data.brief || (data.brief as Brief).schema !== 'investment_brief.v1') return null
    let brand = DEFAULT_BRAND
    if (data.org_id) {
      const org = await supabase.from('broker_orgs').select('name, logo_url, license_no, primary_color').eq('id', data.org_id).maybeSingle()
      brand = brandFromOrg(org.data)
    }
    return { brief: data.brief as Brief, brand, created_at: data.created_at as string }
  } catch {
    return null
  }
}
