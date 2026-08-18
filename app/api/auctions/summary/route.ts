import { NextResponse } from 'next/server'
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

/**
 * Auction aggregates. Counting happens in Postgres via
 * public.auctions_summary_ssot() — the shared SSOT function biddeed.ai and
 * zonewise.ai both call, never in JS (PostgREST caps an unbounded select at
 * 1,000 rows, so any client-side tally over multi_county_auctions is wrong).
 *
 * As of the 2026-08-18 SSOT fix, `upcoming` is live-scoped (2125) while
 * `upcoming_all` is every future-dated row regardless of status (2675).
 * `upcoming_live` and `by_status`/`status_scope` are additive; response keys
 * otherwise stay backwards compatible.
 */
export async function GET() {
  const supabase = getSupabase()

  const { data, error } = await supabase.rpc('auctions_summary_ssot')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const s = (data || {}) as Record<string, unknown>

  return NextResponse.json(
    {
      total: s.total ?? 0,
      upcoming: s.upcoming ?? 0,
      upcoming_all: s.upcoming_all ?? 0,
      upcoming_live: s.upcoming_live ?? 0,
      status_scope: s.status_scope ?? 'live',
      by_status: s.by_status ?? {},
      counties: s.counties ?? 0,
      counties_upcoming: s.counties_upcoming ?? 0,
      by_county: s.by_county ?? {},
      by_type: s.by_type ?? {},
      by_sale_type: s.by_sale_type ?? {},
      // No zoning dimension exists on multi_county_auctions. Returned empty
      // rather than invented, so nothing downstream renders a made-up split.
      by_zoning: {},
      counties_detail: s.counties_detail ?? [],
      with_address: s.with_address ?? 0,
      vacant_land: s.vacant_land ?? 0,
      condos: s.condos ?? 0,
      date_min: s.date_min ?? null,
      date_max: s.date_max ?? null,
      generated_at: s.generated_at ?? null,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  )
}
