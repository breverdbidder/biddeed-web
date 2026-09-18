import { NextRequest, NextResponse } from 'next/server'

import { requireAlertContext } from '@/lib/alerts/server'
import { deedEmail } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const COUNTY_RE = /^[a-z _.'-]{3,40}$/i
const SELECT = 'id,county,alert_types,channels,timezone,status,created_at'

type AddResult = {
  ok?: boolean
  reason?: string
  monitor_id?: string
  tier_id?: string
  cap?: number
  used?: number
  remaining?: number
}

/**
 * County monitors — PROMISE-9 (issue 20518).
 *
 * /pricing prints a county-monitor count on every paid tier: 1 on Investor,
 * 3 on Pro, 10 on Pro Plus. Nothing implemented it.
 *
 * The nearest thing, /api/alerts/watches, watches a single CASE NUMBER in a
 * county — you have to already know the case, which is the opposite of what a
 * monitor is for. It holds 0 rows; nobody has ever used it. A county monitor
 * is the standing instruction: tell me what is coming in Brevard.
 *
 * The cap lives in add_county_monitor(), which reads
 * mcp_subscription_tiers.counties_monitored rather than holding a second copy
 * of 1/3/10 — the page and the ledger already agreed on those numbers, and
 * only one of them should ever be edited.
 *
 * 401 signed out · 400 bad county · 402 out of monitors or a tier with none ·
 * 200 created or already monitored.
 */
export async function GET() {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) {
    return NextResponse.json({ error: context.error }, { status: 401 })
  }
  const { data, error } = await context.supabase
    .from('county_monitors')
    .select(SELECT)
    .eq('clerk_user_id', context.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) return NextResponse.json({ error: 'Unable to load county monitors.' }, { status: 502 })
  return NextResponse.json({ monitors: data ?? [] })
}

export async function POST(request: NextRequest) {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) {
    return NextResponse.json({ error: context.error }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { county?: unknown } | null
  const county = typeof body?.county === 'string' ? body.county.trim() : ''
  if (!COUNTY_RE.test(county)) {
    return NextResponse.json({ error: 'A county is required.' }, { status: 400 })
  }

  const email = await deedEmail()
  const { data, error } = await context.supabase.rpc('add_county_monitor', {
    p_clerk_user_id: context.userId,
    p_email: email,
    p_county: county.toLowerCase(),
  })
  if (error) return NextResponse.json({ error: 'Unable to add this county monitor.' }, { status: 502 })

  const result = (data ?? {}) as AddResult
  if (result.ok) {
    return NextResponse.json(
      {
        monitor_id: result.monitor_id ?? null,
        county: county.toLowerCase(),
        already_monitored: result.reason === 'already_monitored',
        tier_id: result.tier_id ?? 'free',
        cap: result.cap ?? 0,
        used: result.used ?? 0,
        remaining: result.remaining ?? 0,
      },
      { status: result.reason === 'created' ? 201 : 200 }
    )
  }

  const message =
    result.reason === 'cap_reached'
      ? `Your plan covers ${result.cap ?? 0} county monitor${(result.cap ?? 0) === 1 ? '' : 's'}. Remove one to add another.`
      : result.reason === 'tier_has_no_monitors'
        ? 'County monitors start on Investor.'
        : 'A county is required.'

  return NextResponse.json(
    {
      error: message,
      reason: result.reason ?? 'unknown',
      tier_id: result.tier_id ?? 'free',
      cap: result.cap ?? 0,
      used: result.used ?? 0,
      remaining: result.remaining ?? 0,
    },
    { status: result.reason === 'missing_arguments' ? 400 : 402 }
  )
}

export async function DELETE(request: NextRequest) {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) {
    return NextResponse.json({ error: context.error }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const county = (searchParams.get('county') ?? '').trim()
  if (!COUNTY_RE.test(county)) {
    return NextResponse.json({ error: 'A county is required.' }, { status: 400 })
  }
  // Archived, not deleted: a monitor is the reason someone got an email, and
  // "why did you send me this" has to stay answerable after they remove it.
  const { error } = await context.supabase
    .from('county_monitors')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('clerk_user_id', context.userId)
    .eq('county', county.toLowerCase())
    .eq('status', 'active')
  if (error) return NextResponse.json({ error: 'Unable to remove this county monitor.' }, { status: 502 })
  return NextResponse.json({ removed: county.toLowerCase() })
}
