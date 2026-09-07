import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface DiscoveryBody {
  routeId: string
  lat: number
  lng: number
  note: string | null
  signals: string[] | null
  address: string | null
}

function parseDiscoveryBody(value: unknown): DiscoveryBody | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const routeId = typeof input.routeId === 'string' && UUID_RE.test(input.routeId) ? input.routeId : null
  const lat = typeof input.lat === 'number' && Number.isFinite(input.lat) ? input.lat : null
  const lng = typeof input.lng === 'number' && Number.isFinite(input.lng) ? input.lng : null
  if (!routeId || lat === null || lng === null) return null
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null
  const signals = Array.isArray(input.signals) ? input.signals.filter((s): s is string => typeof s === 'string').slice(0, 20) : null
  const address = typeof input.address === 'string' && input.address.trim() ? input.address.trim().slice(0, 300) : null
  return { routeId, lat, lng, note, signals, address }
}

// POST /api/d4d/discoveries — log an off-auction distressed-property find.
export async function POST(request: NextRequest) {
  const check = await requireCapability('log_d4d_field')
  if (!check.allowed || !check.userId) {
    return NextResponse.json(
      { error: 'Field logging requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const body = parseDiscoveryBody(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Invalid discovery.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()

  // Same ownership boundary as PATCH /stops/[id] — d4d_discovery_log trusts
  // whatever p_user_id it is handed, so this app must confirm the route
  // actually belongs to the caller before logging against it.
  const { data: route, error: routeError } = await supabase
    .from('d4d_routes')
    .select('user_id')
    .eq('id', body.routeId)
    .maybeSingle()
  if (routeError) return NextResponse.json({ error: 'Unable to log this find.' }, { status: 502 })
  if (!route || route.user_id !== check.userId) return NextResponse.json({ error: 'Route not found.' }, { status: 404 })

  const { data, error } = await supabase.rpc('d4d_discovery_log', {
    p_route_id: body.routeId,
    p_lat: body.lat,
    p_lng: body.lng,
    p_note: body.note,
    p_signals: body.signals,
    p_address: body.address,
    p_user_id: check.userId,
  })
  if (error) return NextResponse.json({ error: 'Unable to log this find.' }, { status: 502 })
  return NextResponse.json({ discoveryId: data })
}
