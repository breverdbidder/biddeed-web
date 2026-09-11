'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'

import { apiUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const REPORT_SECTIONS = [
  'Subject property identification',
  'Clearing-band value estimate',
  'Market-band value estimate',
  'Comparable sales layer',
  'Comparable quality and confidence',
  'Comparable distance analysis',
  'Comparable timing and market fit',
  'Transaction history',
  'Property record',
  'Listing and auction details',
  'Neighborhood context',
  'School context',
  'Flood-risk context',
  'Market context',
  'Judgment and encumbrance review',
  'Provenance and methodology',
  'Auction outcome tracking',
  'Prediction scorecard and max-bid decision',
]

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

  // Step 1: counties — skipped entirely on the prefill path.
  useEffect(() => {
    if (mcaId) return
    fetch(apiUrl('/buy-report/counties'))
      .then((r) => r.json())
      .then((data: CountyOption[]) => setCounties(data || []))
      .catch(() => setCountiesError('Could not load counties. Please refresh.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcaId])

  function loadAuctions(slug: string, name: string) {
    setCountySlug(slug)
    setCountyName(name)
    setAuctions(null)
    setStep('auction')
    fetch(apiUrl(`/buy-report/auctions?county=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((data: AuctionOption[]) => setAuctions(data || []))
      .catch(() => setAuctions([]))
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

  const mcaIdForSubmit = useMemo(() => (mcaId ? mcaId : null), [mcaId])

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
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error || 'Something went wrong. Please try again.')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-base font-semibold uppercase tracking-[0.18em] text-primary">One-time · no subscription</p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        One SIGNAL$ Property Report — $25
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        ZoneWise zoning, comps, value band, and red flags for one auction. Max-bid and ML figures are labeled Withheld until the rebuilt model is validated. One-time $25, no subscription.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
            Included intelligence overlays: the Shapira third-party-purchase model and ZoneWise.AI land/zoning
            intelligence.
          </p>
        </div>

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
                analysis and the SIGNAL$ Max Bid section, with figures labeled Withheld until the rebuilt model is validated.
              </p>

              {counties === null && !countiesError ? (
                <p className="mt-4 text-sm text-muted-foreground">Loading counties…</p>
              ) : null}
              {countiesError ? <p className="mt-4 text-base text-destructive">{countiesError}</p> : null}
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

              {auctions === null ? <p className="mt-4 text-sm text-muted-foreground">Loading auctions…</p> : null}
              {auctions && auctions.length === 0 ? (
                <p className="mt-4 text-base text-muted-foreground">
                  Calendar sync in progress for {countyName || 'this county'}. Check back in 24 hours or{' '}
                  <a href="/chat" className="inline-flex items-center py-3.5 font-semibold text-primary underline-offset-4 hover:underline">
                    browse live auctions in chat
                  </a>
                  .
                </p>
              ) : null}

              <div className="mt-4 flex max-h-[340px] flex-col gap-2 overflow-y-auto">
                {auctions?.map((a) => (
                  <button
                    key={a.case_number}
                    type="button"
                    onClick={() => pickAuction(a)}
                    className="rounded-lg border border-input bg-background p-3 text-left text-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="font-semibold text-foreground">{a.property_address || 'Address pending'}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                      <span>{fmtDate(a.auction_date)}</span>
                      <span>Opening bid: {fmtMoney(a.opening_bid)}</span>
                      <span>{a.sale_type || ''}</span>
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
              <h2 className="mt-3 text-lg font-semibold text-foreground">One SIGNAL$ Property Report — $25</h2>

              <div className="mt-4 rounded-lg border border-input bg-background p-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">{selected.property_address || 'Address pending'}</div>
                <div className="mt-1">
                  {selected.case_number ? `Case ${selected.case_number} · ` : ''}
                  {countyName} County · {fmtDate(selected.auction_date)}
                </div>
                <div className="mt-1">
                  Opening bid: {fmtMoney(selected.opening_bid)} · {selected.sale_type || ''}
                </div>
              </div>

              {prefillLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading property…</p> : null}
              {prefillError ? <p className="mt-4 text-base text-destructive">{prefillError}</p> : null}

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
                {error ? <p className="text-base text-destructive">{error}</p> : null}
              </form>
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
      </div>
    </div>
  )
}
