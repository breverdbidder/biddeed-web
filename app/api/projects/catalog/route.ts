import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CATALOG_LIMIT = 40

// GET /api/projects/catalog?q=&category= — editable-baseline cost catalog lookup.
export async function GET(request: NextRequest) {
  const check = await requireCapability('get_cost_catalog')
  if (!check.allowed) {
    return NextResponse.json(
      { error: 'The cost catalog requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const category = searchParams.get('category')

  const supabase = getRetryingSupabaseClient(undefined, { retryMode: 'full' })
  const { data, error } = await supabase.rpc('cm_catalog_search', {
    p_q: q && q.trim() ? q.trim() : null,
    p_category: category && category.trim() ? category.trim() : null,
    p_limit: CATALOG_LIMIT,
  })
  if (error) return NextResponse.json({ error: 'Unable to search the cost catalog.' }, { status: 502 })
  return NextResponse.json({ items: data ?? [] })
}
