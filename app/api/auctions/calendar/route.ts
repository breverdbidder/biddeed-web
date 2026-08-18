import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 400

function monthBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
}

/**
 * Per-day typed auction counts for a date range — the calendar's data source.
 *
 * Backed by public.auctions_calendar_counts, the SSOT function biddeed.ai and
 * zonewise.ai both call, so per-day numbers cannot diverge between the two
 * sites. As of the 2026-08-18 SSOT fix, `total` is scope-aware (defaults to
 * 'live': upcoming/active/scheduled only) while `total_all` is every
 * future-dated row regardless of status — redeemed/cancelled/sold inventory
 * inflated `total` by 18.1% before this fix. Both are always surfaced; never
 * render a bare `total` without its scope.
 *
 * GET /api/auctions/calendar?from=&to=&county=&sale_type=&status_scope=
 *   -> { from, to, county, sale_type, status_scope, days: [{ date,
 *        foreclosure_count, tax_deed_count, other_count, total, total_all,
 *        redeemed_count, cancelled_count }], totals: {...} }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const [defFrom, defTo] = monthBounds()

  const from = searchParams.get('from') || defFrom
  const to = searchParams.get('to') || defTo
  const county = searchParams.get('county') || null
  const saleType = searchParams.get('sale_type') || null
  const statusScope = searchParams.get('status_scope') || 'live'

  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (!ISO_DATE.test(value)) {
      return NextResponse.json(
        { error: `invalid ${name}: expected YYYY-MM-DD` },
        { status: 400 }
      )
    }
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be <= to' }, { status: 400 })
  }
  const spanDays =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  if (spanDays > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `range too large: ${spanDays} days (max ${MAX_RANGE_DAYS})` },
      { status: 400 }
    )
  }

  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('auctions_calendar_counts', {
    p_from: from,
    p_to: to,
    p_county: county,
    p_sale_type: saleType,
    p_status_scope: statusScope,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = {
    auction_date: string
    foreclosure_count: number
    tax_deed_count: number
    other_count: number
    total: number
    total_all: number
    redeemed_count: number
    cancelled_count: number
  }
  const rows = (data || []) as Row[]

  const days = rows.map((r) => ({
    date: r.auction_date,
    foreclosure_count: Number(r.foreclosure_count),
    tax_deed_count: Number(r.tax_deed_count),
    other_count: Number(r.other_count),
    total: Number(r.total),
    total_all: Number(r.total_all),
    redeemed_count: Number(r.redeemed_count),
    cancelled_count: Number(r.cancelled_count),
  }))

  const totals = days.reduce(
    (acc, d) => ({
      foreclosure_count: acc.foreclosure_count + d.foreclosure_count,
      tax_deed_count: acc.tax_deed_count + d.tax_deed_count,
      other_count: acc.other_count + d.other_count,
      total: acc.total + d.total,
      total_all: acc.total_all + d.total_all,
      redeemed_count: acc.redeemed_count + d.redeemed_count,
      cancelled_count: acc.cancelled_count + d.cancelled_count,
      days_with_auctions: acc.days_with_auctions + 1,
    }),
    {
      foreclosure_count: 0,
      tax_deed_count: 0,
      other_count: 0,
      total: 0,
      total_all: 0,
      redeemed_count: 0,
      cancelled_count: 0,
      days_with_auctions: 0,
    }
  )

  return NextResponse.json(
    { from, to, county, sale_type: saleType, status_scope: statusScope, days, totals },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  )
}
