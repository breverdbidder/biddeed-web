import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Deployment identity. This is what the CI smoke check asserts against.
 *
 * WHY IT EXISTS. `vercel deploy --prod` returns a per-deployment URL, and this
 * project has deployment protection on those URLs — so the old smoke check
 * curled a host that answers 401 to an unauthenticated request and failed
 * every run at step 10, four seconds in, even though the build and the deploy
 * had both succeeded (measured 2026-08-20, run 32394019653).
 *
 * Pointing the check at the production alias instead would fix the red, but on
 * its own it would be worse than the bug: the alias answers 200 for the
 * PREVIOUS deployment too, so a deploy that silently failed to promote would
 * still pass. That is a check that cannot fail, which is not a check.
 *
 * So the alias is asserted, and this route is how the assertion knows it is
 * looking at the right build: it reports the commit the bundle was built from.
 * The smoke check polls until `sha` equals the SHA it just deployed.
 *
 * BUILD_SHA is inlined at build time by next.config.mjs from GITHUB_SHA, which
 * is set on the runner where `vercel build` executes. Locally it reads 'dev'.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      sha: process.env.BUILD_SHA ?? 'unknown',
      node: process.version,
      ts: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
