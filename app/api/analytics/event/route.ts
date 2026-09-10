import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { FUNNEL_EVENTS } from '@/lib/heatmap/config'

export const dynamic = 'force-dynamic'

interface EventBody {
  event_name: string
  surface?: 'homepage' | 'maps'
  session_id?: string
  geography_level?: 'county' | 'zip'
  geography_id?: string
  kpi_layer?: string
  source?: string
  metadata?: Record<string, unknown>
}

/**
 * POST /api/analytics/event — best-effort funnel event sink for the heatmap
 * KPI funnel (issue #75). Public: most of the funnel (view, gate_shown,
 * signup_started) happens before a Clerk account exists by definition.
 *
 * A tracking write must never break the map. Any failure — bad body, no
 * Supabase credentials, the migration not applied yet — returns 202
 * (accepted) rather than an error the client would have to handle.
 */
export async function POST(request: NextRequest) {
  let body: EventBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid json' }, { status: 202 })
  }

  if (!body.event_name || !FUNNEL_EVENTS.includes(body.event_name as (typeof FUNNEL_EVENTS)[number])) {
    return NextResponse.json({ ok: false, reason: 'unknown event_name' }, { status: 202 })
  }

  let clerkUserId: string | null = null
  try {
    const session = await auth()
    clerkUserId = session.userId
  } catch {
    clerkUserId = null
  }

  try {
    const supabase = getRetryingSupabaseClient()
    const { error } = await supabase.from('heatmap_funnel_events').insert({
      event_name: body.event_name,
      surface: body.surface ?? 'maps',
      session_id: body.session_id ?? null,
      clerk_user_id: clerkUserId,
      geography_level: body.geography_level ?? null,
      geography_id: body.geography_id ?? null,
      kpi_layer: body.kpi_layer ?? null,
      source: body.source ?? null,
      metadata: body.metadata ?? {},
    })
    if (error) {
      console.error(JSON.stringify({ level: 'warn', scope: 'analytics.event', detail: error.message }))
      return NextResponse.json({ ok: false }, { status: 202 })
    }
  } catch (err) {
    console.error(
      JSON.stringify({ level: 'warn', scope: 'analytics.event', detail: (err as Error).message })
    )
    return NextResponse.json({ ok: false }, { status: 202 })
  }

  return NextResponse.json({ ok: true }, { status: 202 })
}
