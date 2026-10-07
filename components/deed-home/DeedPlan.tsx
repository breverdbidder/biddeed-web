'use client'

import Link from '@/components/ui/link'
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleDashed, FileText, Gavel, Landmark, MinusCircle, ShieldCheck, Sparkles, XCircle } from 'lucide-react'

import type { DeedPlanCandidate, DeedPlanResult, PlanSet } from '@/lib/deed/plan'
import { sameOriginHref } from '@/lib/deed/plan'
import { cn } from '@/lib/utils'
import { money, saleDate } from './AuctionCards'

/**
 * Deed's plan — the orchestrator's answer rendered as UI.
 *
 * One row per property the specialist agents ran on, with the screen they
 * produced and, when the storefront sells it today, the $25 SIGNAL$ Property
 * Report checkout. Every figure here is a public-record figure with its basis
 * printed beside it; nothing the report sells is shown (no Max Bid, verdict,
 * model output or lien-by-lien detail — the Worker never sends them).
 */

const AGENT_LABEL: Record<string, string> = {
  'Auction agent': 'Auction calendar',
  'Property agent': 'Property record',
  'Title agent': 'Title search',
  'Rehab agent': 'Rehab scope',
  'Insurance agent': 'Insurance cost',
}

function AgentStrip({ plan }: { plan: DeedPlanResult }) {
  const ran = new Map<string, { ok: number; total: number }>()
  for (const s of plan.steps) {
    if (!AGENT_LABEL[s.agent]) continue
    const cur = ran.get(s.agent) ?? { ok: 0, total: 0 }
    cur.total += 1
    if (s.ok) cur.ok += 1
    ran.set(s.agent, cur)
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Specialist agents Deed ran">
      {plan.specialists.map((agent) => {
        const r = ran.get(agent)
        const ok = r ? r.ok > 0 : false
        return (
          <li
            key={agent}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              ok ? 'border-primary/40 bg-secondary text-foreground' : 'border-border bg-card text-muted-foreground'
            )}
            title={r ? `${r.ok} of ${r.total} calls answered` : 'Not run'}
          >
            {ok ? <CheckCircle2 className="size-3 text-primary" aria-hidden /> : <CircleDashed className="size-3" aria-hidden />}
            {AGENT_LABEL[agent] ?? agent}
          </li>
        )
      })}
      {plan.deferred.map((d) => (
        <li
          key={d.agent}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground"
          title={d.reason}
        >
          <MinusCircle className="size-3" aria-hidden />
          {d.agent.replace(' agent', '')} · coming
        </li>
      ))}
    </ul>
  )
}

function ScreenPill({ c }: { c: DeedPlanCandidate }) {
  const s = c.screen.status
  const map = {
    pass: { label: 'Clears your screen', icon: CheckCircle2, cls: 'border-primary/50 text-primary' },
    screened: { label: 'Screened', icon: CheckCircle2, cls: 'border-border text-foreground' },
    unscreened: { label: 'Not enough data to screen', icon: CircleDashed, cls: 'border-border text-muted-foreground' },
    fail: { label: 'Below your target', icon: XCircle, cls: 'border-border text-muted-foreground' },
  } as const
  const { label, icon: Icon, cls } = map[s] ?? map.unscreened
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-medium', cls)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  )
}

function Figure({ label, value, basis }: { label: string; value: string; basis?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="tabular text-sm font-semibold text-foreground">{value}</dd>
      {basis ? <dd className="truncate text-[11px] text-muted-foreground" title={basis}>{basis}</dd> : null}
    </div>
  )
}

function CandidateRow({ c, price }: { c: DeedPlanCandidate; price: number }) {
  const d = saleDate(c.auction_date)
  const isTax = c.sale_type === 'tax_deed'
  const place = [c.city ? c.city.toLowerCase().replace(/\b[a-z]/g, (x) => x.toUpperCase()) : null, `${c.county_label ?? c.county} County`]
    .filter(Boolean)
    .join(' · ')
  const checkout = c.offer.sellable !== false ? sameOriginHref(c.offer.checkout_url) : null
  const margin = c.screen.margin_pct
  const title = c.title.searched
    ? `${c.title.instruments_on_file ?? 0} recorded instrument${c.title.instruments_on_file === 1 ? '' : 's'} on file`
    : 'Not searched yet'

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground" title={c.property_address ?? undefined}>
            {c.property_address || 'Address pending'}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{place}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              {isTax ? <Landmark className="size-3" aria-hidden /> : <Gavel className="size-3" aria-hidden />}
              {isTax ? 'Tax deed' : c.sale_type === 'foreclosure' ? 'Foreclosure' : 'Sale'}
            </span>
            <span aria-hidden>·</span>
            <span>{d.full}</span>
          </p>
        </div>
        <ScreenPill c={c} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Figure label="Value" value={money(c.screen.value)} basis={c.screen.value_basis} />
        <Figure label="Entry price" value={money(c.screen.entry_price)} basis={c.screen.entry_basis} />
        <Figure label="Rehab (mid)" value={money(c.screen.rehab_mid)} basis={c.screen.rehab_mid != null ? 'standard scope' : c.screen.rehab_basis} />
        <Figure label="Screen margin" value={margin == null ? '—' : `${margin}%`} basis={c.screen.checks.map((k) => `${k.test} ${k.pass === null ? '?' : k.pass ? '✓' : '✗'}`).join(' · ') || null} />
        <Figure
          label="Insurance / yr"
          value={money(c.insurance.premium_annual)}
          basis={c.insurance.premium_annual != null ? `${c.insurance.geography ?? ''}${c.insurance.scaled ? ' (scaled)' : ''}` : null}
        />
        <Figure label="Title" value={title} basis={c.title.searched && c.title.as_of ? `as of ${c.title.as_of}` : null} />
        <Figure label="Deposit" value={money(c.deposit_required)} basis="max($200, 5% of opening bid)" />
        <Figure label="Case" value={c.case_number} />
      </dl>

      {c.screen.flags?.length ? (
        <ul className="mt-3 space-y-1">
          {c.screen.flags.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-xs text-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {checkout ? (
          <Link
            href={checkout}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            data-deed-offer={c.mca_id}
          >
            <FileText className="size-4" aria-hidden />
            Get the {c.offer.product} — ${price}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">{c.offer.reason ?? 'Not sold on the storefront today.'}</p>
        )}
        <Link
          href={`/radar/${encodeURIComponent(c.mca_id)}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          Auction record <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
    </li>
  )
}

function SkeletonRow() {
  return (
    <li className="animate-pulse rounded-xl border border-border bg-card p-4">
      <div className="h-3.5 w-2/3 rounded bg-secondary" />
      <div className="mt-2 h-3 w-1/2 rounded bg-secondary" />
      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="h-5 rounded bg-secondary" />
        <div className="h-5 rounded bg-secondary" />
        <div className="h-5 rounded bg-secondary" />
        <div className="h-5 rounded bg-secondary" />
      </div>
    </li>
  )
}

export default function DeedPlan({ set }: { set: PlanSet }) {
  const { plan, loading, error } = set

  if (loading) {
    return (
      <section aria-label="Deed is working" className="my-1 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Deed is running the specialist agents…
        </h3>
        <p className="text-xs text-muted-foreground">
          Auction calendar → property record → title search → rehab scope → insurance cost, on each matching sale.
        </p>
        <ul className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </ul>
      </section>
    )
  }

  if (error || !plan) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Deed could not build a plan just now ({error ?? 'no answer'}). Ask again in a moment, or{' '}
        <Link href="/radar" className="font-medium text-primary underline underline-offset-2">
          browse the auctions
        </Link>
        .
      </p>
    )
  }

  if (plan.status !== 'ok') {
    return (
      <section aria-label="Deed's plan" className="my-1 space-y-3">
        <AgentStrip plan={plan} />
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">{plan.message}</p>
      </section>
    )
  }

  return (
    <section aria-label="Deed's plan" className="my-1 space-y-3" data-deed-plan={plan.intent.label}>
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          {plan.intent.label}
        </h3>
        {plan.summary ? <p className="text-xs text-muted-foreground">{plan.summary}</p> : null}
        <AgentStrip plan={plan} />
      </div>

      <ul className="space-y-3">
        {plan.candidates.map((c) => (
          <CandidateRow key={c.mca_id} c={c} price={plan.report.price_usd} />
        ))}
      </ul>

      {!plan.sellable && plan.storefront?.county_sells_reports === false && plan.storefront.counties?.length ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
          <p>
            SIGNAL$ Property Reports for {plan.intent.county_label ?? 'this county'} are not on sale on biddeed.ai today. They
            are on sale for tax deed auctions in:
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {plan.storefront.counties.map((sc) => (
              <li key={sc.county}>
                <Link
                  href={`/buy-report?county=${encodeURIComponent(sc.county)}&utm_source=deed&utm_medium=ask_deed&utm_campaign=deed_plan`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary"
                >
                  {sc.county_label}
                  {sc.upcoming != null ? <span className="text-xs text-muted-foreground">· {sc.upcoming} upcoming</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-[11px] leading-5 text-secondary-foreground">
        {plan.screen_note}
      </p>
    </section>
  )
}
