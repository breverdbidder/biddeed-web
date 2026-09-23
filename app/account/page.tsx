import type { Metadata } from 'next'
import { auth, currentUser } from '@clerk/nextjs/server'

import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { getCallerTierId, tierAtLeast } from '@/lib/tier/server'

/**
 * /account — where a paying subscriber lands (issue 20518, PROMISE-2/4/9).
 *
 * Until this page existed, a Pioneer who paid $990 for "30 SIGNAL$ Property
 * Reports a month · 15 skip traces · 3 county monitors" had nowhere in the
 * product to see any of those numbers. Worse, the signed-in sidebar already
 * links "Account dashboard" at /dashboard, which returned 404, and the MCP's own
 * PAYMENT_REQUIRED message points at /upgrade, which also returned 404. Both
 * now redirect here and to /subscribe respectively (next.config.mjs).
 *
 * This page states entitlement, not marketing: every number is read from the
 * same RPCs the gates themselves spend against (signal_report_allowance for
 * reports, county_monitors + mcp_subscription_tiers for monitors), so what a
 * subscriber reads here is what the ledger will actually honour. It holds no
 * second copy of the tier table.
 *
 * Signed out it renders a sign-in prompt rather than redirecting: middleware
 * is a pass-through when Clerk is not configured, so the page has to degrade
 * on its own.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your account — BidDeed.AI',
  description: 'Your plan, your SIGNAL$ Property Report allowance and your county monitors.',
  alternates: { canonical: 'https://biddeed.ai/account' },
  robots: { index: false, follow: false },
}

type Allowance = {
  tier_id?: string
  allowance?: number
  used?: number
  remaining?: number
  period_start?: string | null
}

type Monitor = { id: string; county: string; created_at: string }

const SHELL = 'mx-auto w-full max-w-5xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8'
const CARD = 'mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6'
const CTA =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
const CTA_QUIET =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-5 text-sm font-semibold text-secondary-foreground outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function monthLabel(periodStart: string | null | undefined): string {
  if (!periodStart) return 'this month'
  const parsed = new Date(periodStart)
  if (Number.isNaN(parsed.getTime())) return 'this month'
  return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** A meter that reads as a number first and a bar second — the bar is decoration. */
function Meter({ used, allowance }: { used: number; allowance: number }) {
  const pct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0
  return (
    <div className="mt-4">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="tabular font-semibold text-foreground">{used}</span> of{' '}
        <span className="tabular font-semibold text-foreground">{allowance}</span> used
      </p>
    </div>
  )
}

export default async function AccountPage() {
  let userId: string | null = null
  let email: string | null = null
  try {
    const session = await auth()
    userId = session.userId
    if (userId) {
      const user = await currentUser()
      email =
        user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null
    }
  } catch {
    userId = null
    email = null
  }

  if (!userId) {
    return (
      <div className={SHELL}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your account</p>
        <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
          Sign in to see your plan.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Your report allowance, your county monitors and your plan all live behind your sign-in. If
          you paid for a plan with an email address, sign in with that same address and it will be
          linked automatically.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/sign-in" className={CTA}>
            Sign in
          </a>
          <a href="/pricing" className={CTA_QUIET}>
            See the plans
          </a>
        </div>
      </div>
    )
  }

  const tierId = await getCallerTierId()

  let allowance: Allowance = {}
  let monitors: Monitor[] = []
  let monitorCap = 0
  let tierName = titleCase(tierId)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    try {
      const supabase = getRetryingSupabaseClient(key, { retryMode: 'full' })
      const [allowanceResult, monitorResult, tierResult] = await Promise.all([
        email
          ? supabase.rpc('signal_report_allowance', { p_email: email })
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('county_monitors')
          .select('id,county,created_at')
          .eq('clerk_user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(50),
        supabase
          .from('mcp_subscription_tiers')
          .select('tier_name,counties_monitored')
          .eq('tier_id', tierId)
          .maybeSingle(),
      ])
      if (!allowanceResult.error && allowanceResult.data) allowance = allowanceResult.data as Allowance
      if (!monitorResult.error && Array.isArray(monitorResult.data)) monitors = monitorResult.data as Monitor[]
      if (!tierResult.error && tierResult.data) {
        const row = tierResult.data as { tier_name?: string; counties_monitored?: number }
        monitorCap = row.counties_monitored ?? 0
        if (row.tier_name) tierName = row.tier_name
      }
    } catch {
      // Fall through to the zeroed defaults. An account page that 500s is
      // worse than one that shows a plan with no numbers and a support link.
    }
  }

  const reportAllowance = allowance.allowance ?? 0
  const reportsUsed = allowance.used ?? 0
  const reportsLeft = allowance.remaining ?? Math.max(0, reportAllowance - reportsUsed)
  const paid = tierAtLeast(tierId, 'investor')

  return (
    <div className={SHELL}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your account</p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        {paid ? `You are on ${tierName}.` : 'You are on the free plan.'}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        {paid
          ? 'Everything your plan includes, counted against what you have actually used. These are the same numbers the product itself checks before it hands you a report or an alert.'
          : 'Free covers the public auction calendar. Reports, county monitors and the field tools start on a paid plan.'}
        {email ? <span className="block pt-2 text-sm">Signed in as {email}.</span> : null}
      </p>

      <section className={CARD} aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="text-lg font-semibold text-card-foreground">
          SIGNAL$ Property Reports
        </h2>
        {reportAllowance > 0 ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your plan includes <span className="tabular font-semibold text-foreground">{reportAllowance}</span>{' '}
              reports in {monthLabel(allowance.period_start)}. Claiming one costs nothing extra —
              open any auction and take the report from there.
            </p>
            <Meter used={reportsUsed} allowance={reportAllowance} />
            <p className="mt-4 text-sm text-muted-foreground">
              {reportsLeft > 0 ? (
                <>
                  <span className="tabular font-semibold text-foreground">{reportsLeft}</span> left this
                  month. Re-opening a property you already claimed is always free.
                </>
              ) : (
                <>
                  You have used every report in your plan this month. Your allowance resets on the
                  first of next month, or you can buy a single report for $25.
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/radar" className={CTA}>
                Pick a property
              </a>
              <a href="/buy-report" className={CTA_QUIET}>
                Buy a one-off report
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your plan does not include a monthly report allowance. Single reports are $25, or
              Investor and above include them every month.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/pricing" className={CTA}>
                See what each plan includes
              </a>
              <a href="/buy-report" className={CTA_QUIET}>
                Buy a single report
              </a>
            </div>
          </>
        )}
      </section>

      <section className={CARD} aria-labelledby="monitors-heading">
        <h2 id="monitors-heading" className="text-lg font-semibold text-card-foreground">
          County monitors
        </h2>
        {monitorCap > 0 ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A monitor is a standing instruction: tell me what is coming in this county. Your plan
              covers <span className="tabular font-semibold text-foreground">{monitorCap}</span>.
            </p>
            {monitors.length > 0 ? (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {monitors.map((monitor) => (
                  <li key={monitor.id} className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-foreground">
                      {titleCase(monitor.county)} County
                    </span>
                    <span className="text-xs text-muted-foreground">Active</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-border bg-secondary p-4 text-sm text-secondary-foreground">
                You are not monitoring a county yet. Nothing will reach your inbox until you pick
                one.
              </p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="tabular font-semibold text-foreground">{monitors.length}</span> of{' '}
              <span className="tabular font-semibold text-foreground">{monitorCap}</span> in use.
            </p>
            <div className="mt-5">
              <a href="/alerts" className={CTA}>
                Manage monitors
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              County monitors start on Investor. They are the difference between checking the
              calendar and being told when something lands in a county you care about.
            </p>
            <div className="mt-5">
              <a href="/pricing" className={CTA}>
                See the plans
              </a>
            </div>
          </>
        )}
      </section>

      <section className={CARD} aria-labelledby="api-heading">
        <h2 id="api-heading" className="text-lg font-semibold text-card-foreground">
          API keys
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Connect BidDeed.AI to Claude, Cursor or your own agent through the hosted MCP server.
          Create, replace or revoke your key and copy a working setup.
        </p>
        <div className="mt-5">
          <a href="/account/developers" className={CTA_QUIET}>
            Manage API keys
          </a>
        </div>
      </section>

      {!tierAtLeast(tierId, 'proplus') ? (
        <section className={CARD} aria-labelledby="plan-heading">
          <h2 id="plan-heading" className="text-lg font-semibold text-card-foreground">
            Change your plan
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Every plan is billed annually and every number above moves with it. The pricing page
            lists what changes before you commit to anything.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/pricing" className={CTA}>
              Compare plans
            </a>
            <a href="/support" className={CTA_QUIET}>
              Ask a question first
            </a>
          </div>
        </section>
      ) : null}
    </div>
  )
}
