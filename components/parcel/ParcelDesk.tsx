'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CircleCheck, CircleX, Copy, Lock, RotateCcw, TriangleAlert } from 'lucide-react'

import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_BUY_BOX,
  analyze,
  dealFromAuctionLot,
  memoText,
  money,
  pct,
  ratio,
  toBidDeedCall,
} from '@/lib/parcel'
import type { Analysis, Assumptions, BidDeedCall, Strategy } from '@/lib/parcel'
import { EMPTY_PREFILL, isAuctionPrefill, publicParcelHref, type ParcelPrefill } from '@/lib/parcel-prefill'
import { track, SAMPLE_REPORT_PATH } from '@/lib/analytics/funnel'
import { formatCountyLabel } from '@/lib/counties'
import { cn } from '@/lib/utils'

/**
 * Parcel on biddeed.ai (breverdbidder/parcel, vendored in lib/parcel): the
 * visitor's own underwriting of one auction lot. Rental, flip or BRRRR math on
 * the numbers typed here, mapped to BID / REVIEW / SKIP. It runs in the
 * browser only: no model vendor, no BidDeed service, no network call. It is
 * NOT the SIGNAL$ figure, which stays withheld under report policy v1; the
 * call is labelled as the visitor's buy-box result every time it is shown.
 *
 * No maximum bid is computed here. BidDeed's max bid is the SIGNAL$ Max Bid
 * from the machine-learning model (formerly the Shapira formula): the chance
 * a third party buys and the predicted clearing price from prior auction
 * results, plus, on foreclosures, the plaintiff's history of sale price on
 * the dollar against the final judgment. It prints only the policy label
 * until the model passes validation. The old fixed-percentage ceiling is
 * retired (Ariel, 29 Sep 2026) and must not come back, here or anywhere.
 *
 * Free sign-up gate (Ariel, 1 Oct 2026): the result for the visitor's own
 * numbers shows only to a signed-in account (any tier, free included; Clerk
 * accounts carry a verified email). Signed-out visitors get a "create a free
 * account" card; sign-up / sign-in return to this same property through
 * Clerk's redirect_url (validated by safeParcelReturn on the auth pages).
 * The signed-in state comes from the server (/api/viewer/tier), never from
 * the URL. The typed numbers are kept only in this browser's localStorage
 * (PARCEL_DRAFT_KEY) so they are still here after the round trip; they are
 * never sent anywhere. The built-in example stays visible without an account
 * so a visitor can see what the desk produces. No marketing consent is
 * implied by signing up.
 *
 * Florida courthouse sales settle in full within about a day, so the desk
 * defaults to a cash purchase (100% down). Unticking it applies Parcel's
 * financed defaults (20% down, 6.75% / 30 years) for comparison.
 */

type Strat = Extract<Strategy, 'hold' | 'flip' | 'brrrr'>

const STRATEGIES: { id: Strat; label: string; hint: string }[] = [
  { id: 'hold', label: 'Rental', hint: 'Buy, fix, rent' },
  { id: 'flip', label: 'Flip', hint: 'Buy, fix, sell' },
  { id: 'brrrr', label: 'BRRRR', hint: 'Buy, fix, rent, refinance' },
]

const CALL_COPY: Record<BidDeedCall, { word: string; tone: string; Icon: typeof CircleCheck }> = {
  BID: { word: 'BID', tone: 'border-primary bg-primary text-primary-foreground', Icon: CircleCheck },
  REVIEW: { word: 'REVIEW', tone: 'border-primary bg-background text-primary', Icon: TriangleAlert },
  SKIP: { word: 'SKIP', tone: 'border-border bg-muted text-foreground', Icon: CircleX },
}

const EXAMPLE: ParcelPrefill = {
  ...EMPTY_PREFILL,
  address: '10 Courthouse Rd (example)',
  county: 'brevard',
  openingBid: 82_000,
  assessedValue: 140_000,
  arv: 160_000,
  rehab: 25_000,
  rentMonthly: 1_400,
  taxesAnnual: 1_800,
}

type Inputs = {
  address: string
  county: string
  bid: number
  assessedValue: number
  arv: number
  rehab: number
  rentMonthly: number
  taxesAnnual: number
  insuranceAnnual: number
}

function inputsFrom(p: ParcelPrefill): Inputs {
  return {
    address: p.address,
    county: p.county,
    bid: p.openingBid,
    assessedValue: p.assessedValue,
    arv: p.arv,
    rehab: p.rehab,
    rentMonthly: p.rentMonthly,
    taxesAnnual: p.taxesAnnual,
    insuranceAnnual: p.insuranceAnnual,
  }
}

const PARCEL_DRAFT_KEY = 'bd_parcel_local_draft_v1'
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

type Draft = { v: 1; mcaId: string | null; inputs: Inputs; strategy: Strat; cash: boolean; at: number }

function sameInputs(a: Inputs, b: Inputs): boolean {
  return (Object.keys(a) as (keyof Inputs)[]).every((k) => a[k] === b[k])
}

/** The visitor's own numbers, this browser only. Any storage error = no draft. */
function readDraft(mcaId: string | null): Draft | null {
  try {
    const raw = window.localStorage.getItem(PARCEL_DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    if (!d || d.v !== 1 || d.mcaId !== mcaId || !d.inputs || Date.now() - Number(d.at) > DRAFT_TTL_MS) return null
    if (!['hold', 'flip', 'brrrr'].includes(d.strategy)) return null
    return d
  } catch {
    return null
  }
}

function writeDraft(d: Draft | null) {
  try {
    if (d) window.localStorage.setItem(PARCEL_DRAFT_KEY, JSON.stringify(d))
    else window.localStorage.removeItem(PARCEL_DRAFT_KEY)
  } catch {
    // storage blocked: the desk still works, the numbers just do not persist
  }
}

function toNumber(value: string): number {
  const n = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1 flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
        <span className="text-sm text-muted-foreground" aria-hidden>
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          type="number"
          min={0}
          step={100}
          className="w-full bg-transparent py-2 text-base tabular-nums text-foreground outline-none"
          value={value > 0 ? value : ''}
          placeholder="0"
          onChange={(e) => onChange(toNumber(e.target.value))}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      </div>
      {hint ? (
        <span id={`${id}-hint`} className="mt-1 block text-sm text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function keyStats(strategy: Strat, a: Analysis): { label: string; value: string }[] {
  if (strategy === 'flip') {
    return [
      { label: 'Profit', value: money(a.profit) },
      { label: 'Margin on ARV', value: pct(a.margin) },
      { label: 'Return on cash', value: pct(a.roi) },
      { label: 'Cash in the project', value: money(a.grossCashIn) },
    ]
  }
  if (strategy === 'brrrr') {
    return [
      { label: 'Cash left in', value: money(a.cashLeft) },
      { label: 'Cash back at refi', value: money(a.cashBack) },
      { label: 'DSCR on new loan', value: ratio(a.dscr) },
      { label: 'Cash flow / year', value: money(a.cashFlowAnnual) },
    ]
  }
  return [
    { label: 'Cap rate', value: pct(a.capRate) },
    { label: 'Cash-on-cash', value: pct(a.coc) },
    { label: 'DSCR', value: ratio(a.dscr) },
    { label: 'Cash flow / year', value: money(a.cashFlowAnnual) },
  ]
}

export default function ParcelDesk({ prefill }: { prefill: ParcelPrefill }) {
  const fromAuction = isAuctionPrefill(prefill)
  const [inputs, setInputs] = useState<Inputs>(() => inputsFrom(prefill))
  const [strategy, setStrategy] = useState<Strat>('hold')
  const [cash, setCash] = useState(true)
  const [copied, setCopied] = useState(false)
  const [viewer, setViewer] = useState<{ loaded: boolean; signedIn: boolean }>({ loaded: false, signedIn: false })
  const tracked = useRef(false)
  const draftRead = useRef(false)

  // Signed-in state from the server session, never from the URL or storage.
  // A failed check counts as signed out (the gate shows; nothing leaks).
  useEffect(() => {
    let cancelled = false
    fetch('/api/viewer/tier', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => {
        if (!cancelled) setViewer({ loaded: true, signedIn: Boolean(t && t.signed_in === true) })
      })
      .catch(() => {
        if (!cancelled) setViewer({ loaded: true, signedIn: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Bring back the numbers typed before a sign-up round trip (same property,
  // last 24 hours, this browser only).
  useEffect(() => {
    const d = readDraft(prefill.mcaId)
    draftRead.current = true
    if (!d) return
    setInputs(d.inputs)
    setStrategy(d.strategy)
    setCash(Boolean(d.cash))
  }, [prefill.mcaId])

  const isExample = sameInputs(inputs, inputsFrom(EXAMPLE))

  useEffect(() => {
    if (!draftRead.current || isExample) return
    writeDraft({ v: 1, mcaId: prefill.mcaId, inputs, strategy, cash, at: Date.now() })
  }, [inputs, strategy, cash, isExample, prefill.mcaId])

  const set = <K extends keyof Inputs>(key: K, value: Inputs[K]) => setInputs((cur) => ({ ...cur, [key]: value }))

  const assumptions: Assumptions = useMemo(
    () => (cash ? { ...DEFAULT_ASSUMPTIONS, downPct: 100 } : DEFAULT_ASSUMPTIONS),
    [cash]
  )

  // No call until the visitor has typed a number of their own (an ARV or a
  // rent): a desk opened from a real auction would otherwise print SKIP on
  // the opening bid alone, which reads as a verdict on that auction.
  const result = useMemo(() => {
    if (!(inputs.bid > 0) || !(inputs.arv > 0 || inputs.rentMonthly > 0)) return null
    const deal = dealFromAuctionLot({
      id: prefill.mcaId ?? 'parcel-desk',
      address: inputs.address || 'Auction lot',
      county: inputs.county ? formatCountyLabel(inputs.county) : undefined,
      state: 'FL',
      caseNumber: prefill.caseNumber || undefined,
      openingBid: inputs.bid,
      assessedValue: inputs.assessedValue || undefined,
      taxesAnnual: inputs.taxesAnnual,
      rentMonthly: inputs.rentMonthly,
      rehab: inputs.rehab,
      arv: inputs.arv || undefined,
    })
    deal.strategy = strategy
    if (inputs.insuranceAnnual > 0) {
      deal.insuranceAnnual = inputs.insuranceAnnual
      deal.riskNotes = deal.riskNotes.filter((n) => !n.startsWith('Insurance is estimated'))
    }
    const analysis = analyze(deal, assumptions, DEFAULT_BUY_BOX)
    return { deal, analysis, call: toBidDeedCall(analysis.verdict) }
  }, [inputs, strategy, assumptions, prefill.mcaId, prefill.caseNumber])

  // The result shows to a signed-in account, or for the built-in example.
  const gated = Boolean(result) && !isExample && !(viewer.loaded && viewer.signedIn)

  useEffect(() => {
    if (!result || tracked.current || (!viewer.loaded && !isExample)) return
    tracked.current = true
    track('parcel_underwritten', {
      surface: 'parcel',
      strategy,
      call: result.call,
      prefilled: fromAuction,
      gated,
      county: inputs.county || undefined,
      sale_type: prefill.saleType ?? undefined,
    })
  }, [result, strategy, fromAuction, inputs.county, prefill.saleType, viewer.loaded, isExample, gated])

  const returnTo = publicParcelHref(prefill)
  const signUpHref = `/sign-up?redirect_url=${encodeURIComponent(returnTo)}`
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`

  async function copyMemo() {
    if (!result) return
    const text = `${memoText(result.deal, result.analysis, assumptions)}\n\nYour numbers, run in Parcel on biddeed.ai/parcel. Not a SIGNAL$ verdict.`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const reportHref = prefill.mcaId
    ? `/buy-report?${new URLSearchParams({ mca_id: prefill.mcaId, ...(prefill.county ? { county: prefill.county } : {}) }).toString()}`
    : '/buy-report'
  const call = result ? CALL_COPY[result.call] : null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Parcel</p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        Underwrite an auction lot before you bid.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        Type your bid, the after-repair value, rehab, rent and taxes. Parcel runs the rental, flip or BRRRR math in
        your browser and gives your call as BID, REVIEW or SKIP, free with an account. Nothing you type leaves this
        page.
      </p>

      {fromAuction ? (
        <p className="mt-4 max-w-2xl rounded-md border border-border bg-secondary px-4 py-3 text-base text-secondary-foreground">
          Opened from {prefill.address || 'an auction'}
          {prefill.county ? `, ${formatCountyLabel(prefill.county)} County` : ''}
          {prefill.auctionDate ? `, sale ${prefill.auctionDate}` : ''}. The bid starts at the opening bid; the
          after-repair value, rehab and rent are yours to enter.
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()} aria-label="Lot and assumptions">
          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Strategy</legend>
            <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Strategy">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={strategy === s.id}
                  onClick={() => setStrategy(s.id)}
                  className={cn(
                    'min-h-11 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    strategy === s.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  )}
                >
                  <span className="block font-semibold">{s.label}</span>
                  <span className={cn('block text-xs', strategy === s.id ? 'text-primary-foreground' : 'text-muted-foreground')}>
                    {s.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="parcel-address" className="text-sm font-medium text-foreground">
                Property
              </label>
              <input
                id="parcel-address"
                className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={inputs.address}
                placeholder="Street address (optional)"
                onChange={(e) => set('address', e.target.value.slice(0, 120))}
              />
            </div>
            <MoneyField
              id="parcel-bid"
              label="Your bid"
              hint={prefill.openingBid > 0 ? `Opening bid ${money(prefill.openingBid)}. The winning bid is usually higher.` : 'Start at the opening bid.'}
              value={inputs.bid}
              onChange={(n) => set('bid', n)}
            />
            <MoneyField
              id="parcel-arv"
              label="After-repair value (ARV)"
              hint={inputs.assessedValue > 0 ? `County assessed value ${money(inputs.assessedValue)}.` : 'What it sells for once fixed.'}
              value={inputs.arv}
              onChange={(n) => set('arv', n)}
            />
            <MoneyField id="parcel-rehab" label="Rehab" value={inputs.rehab} onChange={(n) => set('rehab', n)} />
            <MoneyField id="parcel-rent" label="Rent / month" value={inputs.rentMonthly} onChange={(n) => set('rentMonthly', n)} />
            <MoneyField id="parcel-taxes" label="Taxes / year" value={inputs.taxesAnnual} onChange={(n) => set('taxesAnnual', n)} />
            <MoneyField
              id="parcel-insurance"
              label="Insurance / year"
              hint="Blank uses 0.8% of the bid. Florida quotes often run higher."
              value={inputs.insuranceAnnual}
              onChange={(n) => set('insuranceAnnual', n)}
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
            <input
              id="parcel-cash"
              type="checkbox"
              className="mt-1 size-5 accent-primary"
              checked={cash}
              onChange={(e) => setCash(e.target.checked)}
            />
            <label htmlFor="parcel-cash" className="text-sm text-foreground">
              <span className="font-medium">Paid in cash at the auction</span>
              <span className="block text-muted-foreground">
                Florida clerk sales settle in full within about a day. Untick to compare a financed purchase (
                {pct(DEFAULT_ASSUMPTIONS.downPct, 0)} down, {pct(DEFAULT_ASSUMPTIONS.ratePct, 2)} / {DEFAULT_ASSUMPTIONS.termYears}{' '}
                years).
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setInputs(inputsFrom(EXAMPLE))}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Load an example
            </button>
            <button
              type="button"
              onClick={() => {
                writeDraft(null)
                setInputs(inputsFrom(prefill))
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="size-4" aria-hidden />
              Reset
            </button>
          </div>
          <details className="rounded-md border border-border">
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-foreground">Assumptions and buy box</summary>
            <p className="px-3 pb-3 text-base leading-7 text-muted-foreground">
            Assumptions: vacancy {pct(DEFAULT_ASSUMPTIONS.vacancyPct, 0)}, management {pct(DEFAULT_ASSUMPTIONS.managementPct, 0)},
            maintenance {pct(DEFAULT_ASSUMPTIONS.maintenancePct, 0)}, reserves {pct(DEFAULT_ASSUMPTIONS.capexPct, 0)}, closing{' '}
            {pct(DEFAULT_ASSUMPTIONS.closingPct, 1)}, {DEFAULT_ASSUMPTIONS.rehabMonths} months of rehab, refinance at{' '}
            {pct(DEFAULT_ASSUMPTIONS.refiLtvPct, 0)} of ARV. Buy box: cap rate {pct(DEFAULT_BUY_BOX.minCap, 1)}, cash-on-cash{' '}
            {pct(DEFAULT_BUY_BOX.minCoc, 0)}, DSCR {ratio(DEFAULT_BUY_BOX.minDscr)}, flip margin {pct(DEFAULT_BUY_BOX.minFlipMargin, 0)}.
            </p>
          </details>
        </form>

        <section aria-live="polite" aria-label="Your underwriting" className="lg:sticky lg:top-6 lg:self-start">
          {result && call && gated ? (
            <div className="rounded-lg border border-border bg-card p-5 text-card-foreground sm:p-6">
              {viewer.loaded ? (
                <>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Lock className="size-4" aria-hidden />
                    Your result is ready
                  </p>
                  <h2 className="font-display mt-3 text-balance text-2xl font-medium leading-snug text-foreground">
                    Create a free account to see it.
                  </h2>
                  <p className="mt-2 text-base leading-7 text-muted-foreground">
                    Free with your email. No card and no purchase. Your numbers stay in this browser and are still here
                    after you sign up; BidDeed does not receive them.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href={signUpHref}
                      onClick={() => track('signup_prompt_clicked', { surface: 'parcel_gate' })}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Create free account
                      <ArrowRight className="size-4" aria-hidden />
                    </a>
                    <a
                      href={signInHref}
                      className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Sign in
                    </a>
                  </div>
                  <p className="mt-4 text-base leading-6 text-muted-foreground">
                    Want to see what you get first? Load the example: its full memo shows without an account.
                  </p>
                </>
              ) : (
                <p className="text-base text-muted-foreground">Checking your account…</p>
              )}
            </div>
          ) : result && call ? (
            <div className="rounded-lg border border-border bg-card p-5 text-card-foreground sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {isExample ? 'The example says' : 'Your numbers say'}
                </p>
                <span className={cn('inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-bold tracking-wide', call.tone)}>
                  <call.Icon className="size-4" aria-hidden />
                  {call.word}
                </span>
              </div>
              <h2 className="font-display mt-3 text-2xl font-medium leading-snug text-foreground">{result.analysis.headline}</h2>
              <p className="mt-2 text-base tabular-nums text-muted-foreground">{result.analysis.metricLine}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {keyStats(strategy, result.analysis).map((s) => (
                  <Stat key={s.label} label={s.label} value={s.value} />
                ))}
              </div>

              <div className="mt-4 rounded-md border border-border bg-secondary p-3 text-base leading-7 text-secondary-foreground">
                <p>
                  <span className="font-semibold">SIGNAL$ Max Bid</span>: Withheld - validation in progress.
                </p>
                <p className="mt-1">
                  BidDeed&apos;s max bid comes from its machine-learning model, not a fixed formula: the chance a third
                  party buys at the sale and the price it is likely to clear at, learned from prior Florida auction
                  results. On a foreclosure it adds the plaintiff&apos;s record of what its sales brought, on the dollar,
                  against the final judgment. It stays withheld until the model passes validation.
                </p>
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-semibold text-foreground">Why</h3>
                <ul className="mt-2 space-y-2 text-base leading-7 text-foreground">
                  {result.analysis.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">Check before you bid</h3>
                <ul className="mt-2 space-y-2 text-base leading-7 text-muted-foreground">
                  {result.analysis.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  <li>Liens that survive the sale, the clerk&apos;s file and the title are not in this math.</li>
                </ul>
              </div>

              <details className="mt-4 rounded-md border border-border">
                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-foreground">Statement</summary>
                <div className="overflow-x-auto px-3 pb-3">
                  <table className="w-full text-sm tabular-nums">
                    <tbody>
                      {result.analysis.statement.map((row) => (
                        <tr key={row.label} className={cn(row.rule === 'above' && 'border-t border-border')}>
                          <td className={cn('py-1.5 pr-3 text-muted-foreground', row.strong && 'font-semibold text-foreground')}>{row.label}</td>
                          <td className={cn('py-1.5 text-right text-foreground', row.strong && 'font-semibold')}>{money(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={copyMemo}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {copied ? 'Memo copied' : 'Copy memo'}
                </button>
              </div>
              <p className="mt-4 text-base leading-6 text-muted-foreground">
                This call comes from the numbers you entered and the buy box above. It is not a SIGNAL$ verdict, and BidDeed
                does not see these numbers.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-card-foreground">
              <p className="text-base font-semibold text-foreground">
                {inputs.bid > 0 ? 'Add your after-repair value or rent.' : 'Enter a bid to start.'}
              </p>
              <p className="mt-2 text-base text-muted-foreground">
                Parcel gives a call only on numbers you enter. Rental needs rent and taxes; a flip needs the after-repair value
                and rehab; BRRRR needs all of them. Or load the example to see a filled memo.
              </p>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-border bg-background p-5">
            <p className="text-base font-semibold text-foreground">Underwriting a real Florida auction?</p>
            <p className="mt-1 text-base text-muted-foreground">
              The $25 SIGNAL$ Property Report adds the county record, comps, zoning, and the liens that survive the sale.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href={reportHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {prefill.mcaId ? 'Get the report for this auction - $25' : 'Get a SIGNAL$ report - $25'}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              {prefill.mcaId ? (
                <Link
                  href={SAMPLE_REPORT_PATH}
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  See a sample report
                </Link>
              ) : (
                <Link
                  href="/radar"
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Find an auction on the Radar
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
