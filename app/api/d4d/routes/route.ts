import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabase() {
  return getRetryingSupabaseClient()
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface BuildBody {
  name: string
  county: string | null
  auctionDate: string | null
  mcaIds: string[]
  originLat: number | null
  originLng: number | null
}

function parseBuildBody(value: unknown): BuildBody | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > 200) return null
  const county = typeof input.county === 'string' && input.county.trim() ? input.county.trim().toLowerCase() : null
  const auctionDate = typeof input.auctionDate === 'string' && ISO_DATE.test(input.auctionDate) ? input.auctionDate : null
  const mcaIds = Array.isArray(input.mcaIds) ? input.mcaIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id)) : []
  if (!mcaIds.length) return null
  const originLat = typeof input.originLat === 'number' && Number.isFinite(input.originLat) ? input.originLat : null
  const originLng = typeof input.originLng === 'number' && Number.isFinite(input.originLng) ? input.originLng : null
  return { name, county, auctionDate, mcaIds, originLat, originLng }
}

// POST /api/d4d/routes — build a route from selected candidates.
export async function POST(request: NextRequest) {
  const check = await requireCapability('build_d4d_route')
  if (!check.allowed || !check.userId) {
    return NextResponse.json(
      { error: 'D4D route building requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const body = parseBuildBody(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Invalid route request.' }, { status: 400 })

  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('d4d_build_route', {
    p_user_id: check.userId,
    p_name: body.name,
    p_mca_ids: body.mcaIds,
    p_origin_lat: body.originLat,
    p_origin_lng: body.originLng,
    p_county: body.county,
    p_auction_date: body.auctionDate,
  })

  if (error) {
    // d4d_build_route raises a plain exception message for the 40-stop cap
    // and for empty/coordinate-less selections — surface it as a 400 rather
    // than a generic 502 so the UI can show the real reason.
    const message = error.message || ''
    if (/stops exceeds the 40-stop limit|no properties selected|none of the selected properties have coordinates/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unable to build this route.' }, { status: 502 })
  }

  return NextResponse.json({ routeId: data })
}

// GET /api/d4d/routes — the signed-in user's routes.
export async function GET() {
  const check = await requireCapability('get_d4d_route')
  if (!check.allowed || !check.userId) {
    return NextResponse.json(
      { error: 'D4D routes require an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('d4d_routes_list', { p_user_id: check.userId, p_limit: 50 })
  if (error) return NextResponse.json({ error: 'Unable to load routes.' }, { status: 502 })
  return NextResponse.json({ routes: data ?? [] })
}
