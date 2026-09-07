import { NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'

export const dynamic = 'force-dynamic'

// auctions_summary_ssot is read-only; force 'full' retry mode since
// supabase-js's .rpc() always issues a POST and would otherwise be treated
// as a potentially non-idempotent write (see supabase-retry.ts).
function getSupabase() {
  return getRetryingSupabaseClient(undefined, { retryMode: 'full' })
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

  // auctions_summary_ssot is a read-only RPC, so getRetryingSupabaseClient()
  // already retries transient failures (including the ~10-30s windows where
  // Supabase's whole compute stack bounces, issue #20090) before this ever
  // sees an error. Diagnostic detail stays server-side; the public response
  // remains generic.
  const { data, error: lastError } = await supabase.rpc('auctions_summary_ssot')

  if (lastError) {
    return NextResponse.json(
      { error: 'Auction summary temporarily unavailable. Please retry shortly.' },
      { status: 503, headers: { 'Retry-After': '3' } }
    )
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
