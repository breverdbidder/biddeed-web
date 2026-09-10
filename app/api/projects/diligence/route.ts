import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability, tierAtLeast } from '@/lib/tier/server'
import { callerOwnsBudget, projectIdForBudget } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DUE_DILIGENCE_MIN_TIER = 'proplus'

// GET /api/projects/diligence?budgetId=... — the aerial capture + structured
// assessment for the property behind a budget, read from gev_captures.
//
// gev_captures is written by the capture+assessment pipeline
// (cli-anything-biddeed#20214), not this app, and may not exist yet (or have
// no row yet for a given property) in any given environment. Any failure to
// read it is treated the same as "no capture" rather than a 500 — that is the
// true, expected state before the pipeline has run for a property, not an
// error condition.
export async function GET(request: NextRequest) {
  const check = await requireCapability('get_rehab_budget')
  if (!check.allowed || !check.email || !tierAtLeast(check.tierId, DUE_DILIGENCE_MIN_TIER)) {
    return NextResponse.json(
      { error: 'Due diligence requires an upgrade.', tierId: check.tierId, upgradeTier: DUE_DILIGENCE_MIN_TIER, upgradePrice: null },
      { status: 402 }
    )
  }

  const budgetId = request.nextUrl.searchParams.get('budgetId') ?? ''
  if (!UUID_RE.test(budgetId)) return NextResponse.json({ error: 'Invalid budget identifier.' }, { status: 400 })

  const supabase = getRetryingSupabaseClient()
  if (!(await callerOwnsBudget(supabase, budgetId, check.email))) {
    return NextResponse.json({ error: 'Budget not found.' }, { status: 404 })
  }

  const projectId = await projectIdForBudget(supabase, budgetId)
  if (!projectId) return NextResponse.json({ capture: null })

  try {
    const { data, error } = await supabase
      .from('gev_captures')
      .select(
        'id, video_url, framing, capture_status, captured_at, assessment, mapillary_image_id, mapillary_captured_at, mapillary_thumb_url, street_view_url, street_view_captured_at'
      )
      .eq('project_id', projectId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return NextResponse.json({ capture: null })
    return NextResponse.json({ capture: data })
  } catch {
    return NextResponse.json({ capture: null })
  }
}
