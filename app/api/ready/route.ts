import { NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * READINESS, as distinct from liveness.
 *
 * `/api/health` answers "is this process up". On 2026-09-08 it answered 200
 * for hours while `GET /api/auctions` was answering 500 to every caller — the
 * Supabase Data API was rejecting all requests and nothing watching the site
 * noticed, because the only probe in existence could not fail for that reason.
 * A check that cannot fail is not a check.
 *
 * So this route exercises the dependency the product cannot work without: a
 * real, cheap, bounded read of the auction table through the same client every
 * auction surface uses. If that read fails, the site is not ready to take
 * traffic and this returns 503 — which is what an uptime monitor, a
 * deploy gate, or a load balancer should be pointed at.
 *
 * Deliberately NOT here:
 *   - build metadata (that is /api/health's job, and CI asserts on it)
 *   - per-dependency detail beyond ok/failed, since this is a public route;
 *     the failing reason goes to the logs, not the body.
 */

const CHECK_TIMEOUT_MS = 4000

type Check = { name: string; ok: boolean; ms: number }

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

async function timed(name: string, fn: () => Promise<unknown>): Promise<Check> {
  const started = Date.now()
  try {
    await withTimeout(Promise.resolve(fn()), CHECK_TIMEOUT_MS)
    return { name, ok: true, ms: Date.now() - started }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        scope: `ready.${name}`,
        detail: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      })
    )
    return { name, ok: false, ms: Date.now() - started }
  }
}

export async function GET() {
  const supabase = getRetryingSupabaseClient()

  const checks = await Promise.all([
    // The exact failure mode that went unnoticed: a plain read through
    // PostgREST. One row, one column — cheap enough to run every minute.
    timed('auctions_read', async () => {
      const { error } = await supabase
        .from('multi_county_auctions')
        .select('id')
        .limit(1)
      if (error) throw new Error(error.message)
    }),
    // The aggregate path is served by a different mechanism (an RPC), so it
    // fails independently of the plain read and is worth its own check.
    timed('auctions_summary_rpc', async () => {
      const { error } = await supabase.rpc('auctions_summary_ssot')
      if (error) throw new Error(error.message)
    }),
  ])

  const ready = checks.every((c) => c.ok)

  return NextResponse.json(
    {
      ready,
      checks: checks.map(({ name, ok, ms }) => ({ name, status: ok ? 'ok' : 'failed', ms })),
      ts: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        ...(ready ? {} : { 'Retry-After': '10' }),
      },
    }
  )
}
