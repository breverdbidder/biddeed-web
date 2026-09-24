'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'

import { apiUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { REPORT_FIELD_RELEASE_POLICY } from '@/lib/report-field-release'
import { REPORT_SECTIONS } from '@/lib/report-sections'
import { track } from '@/lib/analytics/funnel'

type CountyOption = {
  county_slug: string
  display: string
  upcoming: number
  next_auction_date: string | null
  is_gold_standard?: boolean
}

type AuctionOption = {
  case_number: string
  property_address: string | null
  auction_date: string | null
  opening_bid: number | null
  sale_type: string | null
}

type PropertyLookup = {
  case_number?: string
  county?: string
  property_address?: string
  auction_date?: string
  opening_bid?: number | null
  sale_type?: string | null
}

type Step = 'county' | 'auction' | 'checkout'

function fmtDate(d: string | null) {
  if (!d) return 'TBD'
  const dt = new Date(`${d}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return 'N/A'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// Audit P2-15: never show machine strings on a paid surface. DB sale_type
// values are snake_case ('tax_deed'); render customer-facing labels.
function fmtSaleType(t: string | null | undefined) {
  if (!t) return ''
  const known: Record<string, string> = { tax_deed: 'Tax deed', foreclosure: 'Foreclosure' }
  return known[t] || t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

// Audit P2-15: rows whose address was never assigned arrive as
// '00 UNASSIGNED LOCATION RE...' - present a clear availability label with
// the case number instead of leaking the placeholder.
const UNASSIGNED_LOCATION_RE = /^0+\s*UNASSIGNED LOCATION\b/i
function fmtAddress(addr: string | null | undefined, caseNumber: string | null | undefined) {
  if (addr && !UNASSIGNED_LOCATION_RE.test(addr.trim())) return addr
  return caseNumber ? `Address not yet on file - Case ${caseNumber}` : 'Address not yet on file'
}

export default function BuyReportCheckout() {
  const params = useSearchParams()
  const mcaId = params.get('mca_id')
  const caseParam = params.get('case')
  const countyParam = params.get('county')

  const [step, setStep] = useState<Step>('county')
  const [counties, setCounties] = useState<CountyOption[] | null>(null)
  const [countiesError, setCountiesError] = useState('')
  const [countySlug, setCountySlug] = useState('')
  const [countyName, setCountyName] = useState('')

  const [auctions, setAuctions] = useState<AuctionOption[] | null>(null)
  const [auctionsError, setAuctionsError] = useState('')
  const [auctionQuery, setAuctionQuery] = useState('')

  const [selected, setSelected] = useState<{
    case_number: string | null
    property_address: string | null
    auction_date: string | null
    opening_bid: number | null
    sale_type: string | null
  }>({ case_number: null, property_address: null, auction_date: null, opening_bid: null, sale_type: null })

  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [prefillLoading, setPrefillLoading] = useState(Boolean(mcaId) || Boolean(caseParam && countyParam))
  const [prefillError, setPrefillError] = useState('')

  // Prefill flow — arrived from a property card in chat (?mca_id=&address=&county=&date=).
  useEffect(() => {
    if (!mcaId) return
    setCountySlug(params.get('county') || '')
    setCountyName(params.get('county') || '')
    setSelected({
      case_number: null,
      property_address: params.get('address'),
      auction_date: params.get('date'),
      opening_bid: null,
      sale_type: null,
    })
    setStep('checkout')

    fetch(apiUrl(`/property/${encodeURIComponent(mcaId)}`))
      .then((r) => r.json())
      .then((d: PropertyLookup) => {
        if (d && d.case_number) {
          setSelected((prev) => ({
            case_number: d.case_number ?? prev.case_number,
            property_address: d.property_address ?? prev.property_address,
            auction_date: d.auction_date ?? prev.auction_date,
            opening_bid: d.opening_bid ?? prev.opening_bid,
            sale_type: d.sale_type ?? prev.sale_type,
          }))
        } else {
          setPrefillError('Could not load this property — the link may be out of date.')
        }
      })
      .catch(() => setPrefillError('Could not load this property — please try again.'))
      .finally(() => setPrefillLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcaId])

  // Deep-link flow — arrived from a /deal/<county>/<slug> landing page
  // (?case=<case_number>&county=<county_slug>). Without this, those params
  // were silently ignored and every reel-funnel buyer landed on a blank
  // county picker, losing the property they tapped on (issue #20193).
  // Resolve the pair against the same picker feed and jump straight to
  // checkout; when it no longer resolves (auction passed or sold), land on
  // that county's upcoming list instead of a dead end.
  useEffect(() => {
    if (mcaId || !caseParam || !countyParam) return
    const slug = countyParam.replace(/-/g, '_')
    const fallbackName = slug
      .split('_')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ')
    let cancelled = false
    fetch(apiUrl(`/buy-report/auctions?county=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((data: AuctionOption[]) => {
        if (cancelled) return
        const rows = Array.isArray(data) ? data : []
        const match = rows.find((a) => (a.case_number || '').toLowerCase() === caseParam.toLowerCase())
        setCountySlug(slug)
        setCountyName(fallbackName)
        if (match) {
          setSelected({
            case_number: match.case_number,
            property_address: match.property_address,
            auction_date: match.auction_date,
            opening_bid: match.opening_bid,
            sale_type: match.sale_type,
          })
          setStep('checkout')
        } else {
          setAuctions(rows)
          setStep('auction')
        }
      })
      .catch(() => {
        // Leave the visitor on the county picker — the list still loads.
      })
      .finally(() => {
        if (!cancelled) setPrefillLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcaId, caseParam, countyParam])

  // Backfill the pretty county label once the counties list lands.
  useEffect(() => {
    if (!counties || !countySlug) return
    const opt = counties.find((c) => c.county_slug === countySlug)
    if (opt && countyName !== opt.display) setCountyName(opt.display)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counties, countySlug])

  // Step 1: counties — skipped entirely on the prefill path. PARITY CP-1 §2:
  // an error answer is an error (it used to be stored as the county list and
  // left a blank card), and it can be retried in place.
  function loadCounties() {
    setCountiesError('')
    setCounties(null)
    fetch(apiUrl('/buy-report/counties'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error('bad counties payload')
        setCounties(data as CountyOption[])
      })
      .catch(() => setCountiesError('Could not load counties.'))
  }

  useEffect(() => {
    if (mcaId) return
    loadCounties()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcaId])

  function loadAuctions(slug: string, name: string) {
    setCountySlug(slug)
    setCountyName(name)
    setAuctions(null)
    setAuctionsError('')
    setAuctionQuery('')
    setStep('auction')
    // A failed request is shown as a failure with a retry, not as "calendar
    // sync in progress" (what an empty list means).
    fetch(apiUrl(`/buy-report/auctions?county=${encodeURIComponent(slug)}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error('bad auctions payload')
        setAuctions(data as AuctionOption[])
      })
      .catch(() => setAuctionsError('Could not load auctions for this county.'))
  }

  function pickAuction(a: AuctionOption) {
    setSelected({
      case_number: a.case_number,
      property_address: a.property_address,
      auction_date: a.auction_date,
      opening_bid: a.opening_bid,
      sale_type: a.sale_type,
    })
    setStep('checkout')
  }

  // Audit P1-3: filterable list, and rows with no usable address demoted to
  // the bottom (still selectable - fmtAddress shows the case label).
  const visibleAuctions = useMemo(() => {
    if (!auctions) return null
    const hasAddress = (a: AuctionOption) =>
      Boolean(a.property_address && !UNASSIGNED_LOCATION_RE.test(a.property_address.trim()))
    const demoted = [...auctions.filter(hasAddress), ...auctions.filter((a) => !hasAddress(a))]
    const q = auctionQuery.trim().toLowerCase()
    if (!q) return demoted
    return demoted.filter(
      (a) =>
        (a.property_address || '').toLowerCase().includes(q) ||
        (a.case_number || '').toLowerCase().includes(q)
    )
  }, [auctions, auctionQuery])

  const mcaIdForSubmit = useMemo(() => (mcaId ? mcaId : null), [mcaId])

  // PROMISE-4 (issue 20518). Investor, Pro and Pro Plus all print a monthly
  // SIGNAL$ Property Report allowance on /pricing — 10, 30 and 50. Until this
  // existed, this page charged every visitor $25 with no idea who they were,
  // so a Pioneer paying $990/yr for thirty reports a month was asked to pay
  // again for the first one. When the signed-in account has an allowance left,
  // the whole page switches to claiming rather than buying.
  //
  // Same-origin fetch, not apiUrl(): allowance lives behind the Clerk session
  // on this app, not on the worker API. A 401 here is the ordinary signed-out
  // case and must leave the $25 path exactly as it was.
  const [allowance, setAllowance] = useState<{ tier_id: string; allowance: number; used: number; remaining: number } | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState<{ already: boolean; remaining: number } | null>(null)
  // Signed-out visitor (allowance answered 401): show the free-account prompt.
  const [signedOut, setSignedOut] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/reports/allowance')
      .then((r) => {
        if (live && r.status === 401) setSignedOut(true)
        return r.ok ? r.json() : null
      })
      .then((d) => {
        if (live && d && typeof d.remaining === 'number') setAllowance(d)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const included = Boolean(allowance && allowance.allowance > 0)
  const canClaim = Boolean(allowance && allowance.remaining > 0)

  async function handleClaim() {
    setError('')
    setClaiming(true)
    try {
      const res = await fetch('/api/reports/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          county: countyName || countySlug,
          case_number: selected.case_number,
          mca_id: mcaIdForSubmit,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setClaimed({ already: Boolean(data.already_claimed), remaining: Number(data.remaining ?? 0) })
        setAllowance((prev) => (prev ? { ...prev, used: Number(data.used ?? prev.used), remaining: Number(data.remaining ?? prev.remaining) } : prev))
        return
      }
      setError(data.error || 'Could not claim this report. Please try again.')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(apiUrl('/buy-report/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          county: countySlug || null,
          case_number: selected.case_number,
          mca_id: mcaIdForSubmit,
          marketing_consent: consent,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        track(
          'checkout_started',
          { product: 'signal_report', price_usd: 25, currency: 'usd', surface: 'buy_report', county: countySlug || null, sale_type: selected.sale_type ?? null },
          { beacon: true }
        )
        window.location.href = data.url
        // Stay in "Redirecting to checkout…" while the browser leaves: the
        // button must not re-arm (and invite a second session) mid-navigation.
        return
      }
      setError(data.error || 'Something went wrong. Please try again.')
      setSubmitting(false)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-base font-semibold uppercase tracking-[0.18em] text-primary">
        {included ? 'Included in your plan' : 'One-time · no subscription'}
      </p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        {included ? 'Your SIGNAL$ Property Reports' : 'One SIGNAL$ Property Report — $25'}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        {included
          ? `A source-backed snapshot for one auction: official auction facts, parcel and assessment data, comps, zoning, and red flags when their source and exact property match are verified. You have ${allowance?.remaining ?? 0} of ${allowance?.allowance ?? 0} reports left this month on your plan.`
          : 'A source-backed snapshot for one auction: official auction facts, parcel and assessment data, comps, zoning, and red flags when their source and exact property match are verified. One-time $25, no subscription.'}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex gap-1.5" aria-hidden>
            {(['county', 'auction', 'checkout'] as const).map((s, i) => (
              <span
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  step === s || (['county', 'auction', 'checkout'] as const).indexOf(step) > i
                    ? 'bg-primary'
                    : 'bg-border'
                )}
              />
            ))}
          </div>

          {step === 'county' && !mcaId ? (
            <div className="mt-5">
              <h2 className="text-lg font-semibold text-foreground">Pick your county</h2>
              <p className="mt-1 text-base text-muted-foreground">
                Gold Standard counties include full CMA and ZoneWise zoning. All counties include opening bid
                analysis and the source-backed evidence sections. Probability, predicted sale price, and SIGNAL$ Max Bid belong to Pro Plus and remain Withheld - validation in progress.
              </p>

              {counties === null && !countiesError ? (
                <div role="status" aria-busy="true" className="mt-4">
                  <span className="sr-only">Loading counties…</span>
                  <Skeleton className="h-11 w-full" aria-hidden="true" />
                </div>
              ) : null}
              {countiesError ? (
                <div role="alert" className="mt-4 flex flex-wrap items-center gap-x-3 text-base text-destructive">
                  <span>{countiesError}</span>
                  <button type="button" onClick={loadCounties} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Try again</button>
                </div>
              ) : null}
              {counties && counties.length === 0 ? (
                <p className="mt-4 text-base text-muted-foreground">
                  No counties with upcoming auctions right now — check back soon.
                </p>
              ) : null}

              {counties && counties.length > 0 ? (
                <label className="mt-4 block">
                  <span className="sr-only">Select a county</span>
                  <select
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    defaultValue=""
                    onChange={(e) => {
                      const opt = counties.find((c) => c.county_slug === e.target.value)
                      if (opt) loadAuctions(opt.county_slug, opt.display)
                    }}
                  >
                    <option value="" disabled>
                      Select a county…
                    </option>
                    {counties.map((c) => (
                      <option key={c.county_slug} value={c.county_slug}>
                        {c.is_gold_standard ? `${c.display} ⭐` : c.display} — {c.upcoming} upcoming · Next:{' '}
                        {fmtDate(c.next_auction_date)}
                        {c.is_gold_standard ? '' : ' · Data under review'}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {step === 'auction' ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setStep('county')}
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                ← Change county
              </button>
              <h2 className="mt-3 text-lg font-semibold text-foreground">Pick your auction</h2>
              <p className="mt-1 text-base text-muted-foreground">Upcoming auctions in {countyName}.</p>

              {auctions === null && !auctionsError ? (
                <div role="status" aria-busy="true" className="mt-4 flex flex-col gap-2">
                  <span className="sr-only">Loading auctions…</span>
                  {[0, 1, 2].map((i) => (
                    <div key={i} aria-hidden="true" className="rounded-lg border border-input bg-background p-3">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : null}
              {auctionsError ? (
                <div role="alert" className="mt-4 flex flex-wrap items-center gap-x-3 text-base text-destructive">
                  <span>{auctionsError}</span>
                  <button type="button" onClick={() => loadAuctions(countySlug, countyName)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Try again</button>
                </div>
              ) : null}
              {auctions && auctions.length === 0 ? (
                <p className="mt-4 text-base text-muted-foreground">
                  Calendar sync in progress for {countyName || 'this county'}. Check back in 24 hours or{' '}
                  <a href="/chat" className="inline-flex items-center py-3.5 font-semibold text-primary underline-offset-4 hover:underline">
                    browse live auctions in chat
                  </a>
                  .
                </p>
              ) : null}

              {auctions && auctions.length > 5 ? (
                <label className="mt-3 block">
                  <span className="sr-only">Filter auctions</span>
                  <input
                    type="search"
                    value={auctionQuery}
                    onChange={(e) => setAuctionQuery(e.target.value)}
                    placeholder="Filter by address or case number"
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
              ) : null}

              {visibleAuctions && visibleAuctions.length === 0 && auctions && auctions.length > 0 ? (
                <p className="mt-4 text-base text-muted-foreground">
                  No auctions match &ldquo;{auctionQuery.trim()}&rdquo; in {countyName}.
                </p>
              ) : null}

              <div className="mt-4 flex max-h-[340px] flex-col gap-2 overflow-y-auto">
                {visibleAuctions?.map((a) => (
                  <button
                    key={a.case_number}
                    type="button"
                    onClick={() => pickAuction(a)}
                    className="rounded-lg border border-input bg-background p-3 text-left text-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="font-semibold text-foreground">{fmtAddress(a.property_address, a.case_number)}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                      <span>{fmtDate(a.auction_date)}</span>
                      <span>Opening bid: {fmtMoney(a.opening_bid)}</span>
                      <span>{fmtSaleType(a.sale_type)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 'checkout' ? (
            <div className="mt-5">
              {!mcaId ? (
                <button
                  type="button"
                  onClick={() => setStep('auction')}
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  ← Change auction
                </button>
              ) : null}
              <h2 className="mt-3 text-lg font-semibold text-foreground">
                {included ? 'Claim this report — included in your plan' : 'One SIGNAL$ Property Report — $25'}
              </h2>

              <div className="mt-4 rounded-lg border border-input bg-background p-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">{fmtAddress(selected.property_address, selected.case_number)}</div>
                <div className="mt-1">
                  {selected.case_number ? `Case ${selected.case_number} · ` : ''}
                  {countyName} County · {fmtDate(selected.auction_date)}
                </div>
                <div className="mt-1">
                  Opening bid: {fmtMoney(selected.opening_bid)} · {fmtSaleType(selected.sale_type)}
                </div>
              </div>

              {prefillLoading ? (
                <div role="status" aria-busy="true" className="mt-4">
                  <span className="sr-only">Loading property…</span>
                  <Skeleton className="h-4 w-2/3" aria-hidden="true" />
                  <Skeleton className="mt-2 h-3 w-1/2" aria-hidden="true" />
                </div>
              ) : null}
              {prefillError ? <p className="mt-4 text-base text-destructive">{prefillError}</p> : null}

              <div className="mt-4 rounded-lg border border-border bg-secondary p-3 text-sm leading-5 text-foreground">
                <p className="font-semibold">Source-backed evidence report</p>
                <p className="mt-1 text-muted-foreground">Missing or unverified fields are marked Unavailable, Needs review, or Withheld. No model estimate is substituted.</p>
                <p className="mt-2 text-muted-foreground">{REPORT_FIELD_RELEASE_POLICY.report_offer.promise}</p>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
                <p><span className="font-semibold text-foreground">Pro Plus model fields:</span> Withheld - validation in progress</p>
                <p className="mt-1">Third-party purchase probability · Predicted sale price · SIGNAL$ Max Bid</p>
              </div>

              {included ? (
                <div className="mt-5 flex flex-col gap-3">
                  <p className="text-base leading-6 text-foreground">
                    {claimed
                      ? claimed.already
                        ? `Already claimed — this one did not cost a report. ${claimed.remaining} of ${allowance?.allowance ?? 0} reports left this month.`
                        : `Claimed. ${claimed.remaining} of ${allowance?.allowance ?? 0} reports left this month — it arrives by email when it finishes building.`
                      : `${allowance?.remaining ?? 0} of ${allowance?.allowance ?? 0} reports left this month on your ${allowance?.tier_id === 'proplus' ? 'Pro Plus' : allowance?.tier_id === 'pro' ? 'Pro' : 'Investor'} plan.`}
                  </p>
                  {claimed ? null : (
                    <Button type="button" onClick={handleClaim} disabled={claiming || prefillLoading || !canClaim} className="mt-1 min-h-11">
                      {claiming ? (
                        'Claiming…'
                      ) : (
                        <>
                          <Check className="size-4" aria-hidden />
                          {canClaim ? 'Claim this report — included' : 'No reports left this month'}
                        </>
                      )}
                    </Button>
                  )}
                  {/* The one-time path stays reachable on purpose: running out
                      mid-month must not become a dead end when the next
                      auction is on Thursday. */}
                  {!canClaim && !claimed ? (
                    <button
                      type="button"
                      onClick={() => setAllowance(null)}
                      className="self-start text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Buy this one for $25 instead →
                    </button>
                  ) : null}
                  {error ? <p className="text-base text-destructive" role="alert">{error}</p> : null}
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
                <label htmlFor="br-email" className="text-sm font-medium text-foreground">
                  Email address (report delivered here)
                </label>
                <Input
                  id="br-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-11"
                />
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-input"
                  />
                  Send me occasional auction intelligence updates (optional)
                </label>
                <Button type="submit" disabled={submitting || prefillLoading} className="mt-2 min-h-11">
                  {submitting ? (
                    'Redirecting to checkout…'
                  ) : (
                    <>
                      <Check className="size-4" aria-hidden />
                      Get my SIGNAL$ Property Report — $25
                    </>
                  )}
                </Button>
                {error ? <p className="text-base text-destructive" role="alert">{error}</p> : null}
                {signedOut ? (
                  <p className="mt-1 rounded-lg bg-secondary px-4 py-3 text-sm text-foreground">
                    New to biddeed.ai?{' '}
                    <a
                      href="/sign-up?redirect_url=%2Fbuy-report"
                      onClick={() => track('signup_prompt_clicked', { surface: 'buy_report' })}
                      className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Create a free account
                    </a>{' '}
                    first - it takes a minute and your Radar tracks the next auction for you.
                  </p>
                ) : null}
              </form>
              )}
            </div>
          ) : null}

          <p className="mt-6 border-t border-border pt-4 text-base leading-5 text-muted-foreground">
            Not legal advice. BidDeed.AI is an information and analytics platform, not a law firm or title company.
            Auction data and bid estimates are informational and must be independently verified — always consult a
            licensed Florida attorney before bidding. See{' '}
            <a href="/disclaimer" className="inline-flex items-center py-3.5 font-semibold text-primary underline-offset-4 hover:underline">
              full disclaimer
            </a>
            .
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="text-base font-semibold text-foreground">What your report includes</p>
          <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {REPORT_SECTIONS.map((section, index) => (
              <li key={section} className="flex gap-3 text-base">
                <span className="font-mono text-xs font-bold text-primary">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-foreground">{section}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-border pt-4 text-base leading-5 text-muted-foreground">
            Source-backed evidence includes its source and effective date. Probability, predicted sale price, and SIGNAL$ Max Bid are Pro Plus fields and currently show Withheld - validation in progress.
          </p>
        </div>

      </div>
    </div>
  )
}
