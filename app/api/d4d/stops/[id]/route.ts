import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FIELD_STATUSES = new Set(['pending', 'vacant', 'occupied', 'uncertain', 'skip', 'bid', 'review', 'd4d_find'])

function validId(value: string) {
  return UUID_RE.test(value) ? value : null
}

interface StopBody {
  fieldStatus: string | null
  note: string | null
  severity: string | null
  source: string | null
}

function parseStopBody(value: unknown): StopBody | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const fieldStatus = typeof input.fieldStatus === 'string' ? input.fieldStatus.toLowerCase() : null
  if (fieldStatus !== null && !FIELD_STATUSES.has(fieldStatus)) return null
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null
  const severity = typeof input.severity === 'string' && input.severity.trim() ? input.severity.trim().toLowerCase() : null
  const source = typeof input.source === 'string' && input.source.trim() ? input.source.trim().slice(0, 40) : null
  if (fieldStatus === null && note === null) return null
  return { fieldStatus, note, severity, source }
}

// PATCH /api/d4d/stops/[id] — mark a stop and write a field observation.
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const check = await requireCapability('log_d4d_field')
  if (!check.allowed || !check.userId) {
    return NextResponse.json(
      { error: 'Field logging requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const id = validId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Invalid stop identifier.' }, { status: 400 })

  const body = parseStopBody(await request.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Invalid stop update.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()

  // d4d_stop_update carries no user scoping of its own (SECURITY DEFINER,
  // trusts p_stop_id alone) — this app is the only authorization boundary
  // between "signed in" and "can edit any user's route", so ownership is
  // checked here before the write.
  const { data: stop, error: stopError } = await supabase
    .from('d4d_route_stops')
    .select('id, route_id')
    .eq('id', id)
    .maybeSingle()
  if (stopError) return NextResponse.json({ error: 'Unable to update this stop.' }, { status: 502 })
  if (!stop) return NextResponse.json({ error: 'Stop not found.' }, { status: 404 })

  const { data: route, error: routeError } = await supabase
    .from('d4d_routes')
    .select('user_id')
    .eq('id', stop.route_id)
    .maybeSingle()
  if (routeError || !route || route.user_id !== check.userId) {
    return NextResponse.json({ error: 'Stop not found.' }, { status: 404 })
  }

  const { data, error } = await supabase.rpc('d4d_stop_update', {
    p_stop_id: id,
    p_field_status: body.fieldStatus,
    p_note: body.note,
    p_severity: body.severity,
    p_source: body.source ?? 'web',
  })
  if (error) return NextResponse.json({ error: 'Unable to update this stop.' }, { status: 502 })
  return NextResponse.json({ stop: data })
}
