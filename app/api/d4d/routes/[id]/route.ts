import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validId(value: string) {
  return UUID_RE.test(value) ? value : null
}

// GET /api/d4d/routes/[id] — one route's stops, discoveries and photo count.
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const check = await requireCapability('get_d4d_route')
  if (!check.allowed || !check.userId) {
    return NextResponse.json(
      { error: 'D4D routes require an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const id = validId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Invalid route identifier.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient(undefined, { retryMode: 'full' })
  const { data, error } = await supabase.rpc('d4d_route_detail', { p_route_id: id })
  if (error) return NextResponse.json({ error: 'Unable to load this route.' }, { status: 502 })

  const route = data?.route as Record<string, unknown> | undefined
  if (!route || route.user_id !== check.userId) {
    return NextResponse.json({ error: 'Route not found.' }, { status: 404 })
  }

  return NextResponse.json(data)
}
