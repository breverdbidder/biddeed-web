'use client'

import { ArrowRight, Check, FileText, MessageSquareText, Search, Target } from 'lucide-react'

import { formatCount, useAuctionCounts } from '@/components/shell/useAuctionCounts'
import { cn } from '@/lib/utils'

/**
 * Everything below the conversation on the empty home. Supporting evidence,
 * not the product: the product is the composer above it.
 *
 * Commercial destinations are Cloudflare Worker routes (checkout, reports,
 * county pages) and stay plain <a> elements on purpose — a <Link> would try to
 * resolve them inside this app's router and paint a client-side 404 over a
 * page that works at the edge.
 */
export const W = {
  buyReport: '/buy-report',
  freeReport: '/free-report',
  subscribeInvestor: '/subscribe?tier=investor',
  subscribePro: '/subscribe?tier=pro',
  counties: '/counties',
  blog: '/blog',
  pioneers: '/pioneers',
  terms: '/terms',
  privacy: '/privacy',
  security: '/security',
  disclaimer: '/disclaimer',
  // Published by the Worker as a public sample. Not a customer credential.
  sampleReport: '/report/cad5d07a-b9c7-433d-b365-3165637b7cbe?key=bd_live_S9KLXyeH9fV1epdliLz731n1',
}

export const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
export const BTN_PRIMARY = cn(BTN, 'bg-primary text-primary-foreground hover:bg-primary/90')
export const BTN_QUIET = cn(BTN, 'border border-border bg-card text-foreground hover:border-primary/60 hover:text-primary')

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>
}

function H2({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl', className)}>
      {children}
    </h2>
  )
}

/* ── Live counts ─────────────────────────────────────────────────────────── */

export function TrustStrip() {
  const c = useAuctionCounts()
  const items = [
    { value: formatCount(c.upcoming), label: 'upcoming sales', title: 'Live-scoped upcoming auctions across Florida, from the shared auction summary.' },
    { value: formatCount(c.counties), label: 'counties with sales', title: 'Counties with at least one upcoming sale on the calendar right now.' },
    { value: formatCount(c.total), label: 'auction records', title: 'Every foreclosure and tax deed auction record BidDeed.AI has captured to date.' },
  ]
  return (
    <dl className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-2" title={it.title}>
          <dd className={cn('tabular text-lg font-semibold text-foreground', c.loading && 'animate-pulse')}>{it.value}</dd>
          <dt className="text-sm text-muted-foreground">{it.label}</dt>
        </div>
      ))}
      <div className="flex items-baseline gap-2">
        <dd className="text-lg font-semibold text-foreground">67</dd>
        <dt className="text-sm text-muted-foreground">Florida counties covered</dt>
      </div>
    </dl>
  )
}

/* ── Proof ───────────────────────────────────────────────────────────────── */

export function Proof() {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="grid gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Published before the sale. Checked after it.</Eyebrow>
          <H2>Every US auction. One number. Zero guesswork.</H2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            For a Marion County foreclosure on 20 July 2026, BidDeed.AI published a maximum bid of $82,000
            before the sale. The property sold for $73,501. A bidder who held to the ceiling won the lot with
            room to spare — and the report re-issued itself with the outcome the same day.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={W.sampleReport} className={BTN_QUIET}>
              Read the full sample report <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="flex items-baseline justify-between gap-3 rounded-2xl border border-border bg-background p-4 sm:flex sm:min-h-[128px] sm:flex-col sm:items-center sm:justify-center sm:text-center">
            <dt className="text-[11px] uppercase leading-snug tracking-wide text-muted-foreground">Max bid published</dt>
            <dd className="tabular whitespace-nowrap text-lg font-semibold text-foreground sm:mt-2 sm:text-2xl">$82,000</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-2xl border border-border bg-background p-4 sm:flex sm:min-h-[128px] sm:flex-col sm:items-center sm:justify-center sm:text-center">
            <dt className="text-[11px] uppercase leading-snug tracking-wide text-muted-foreground">Sale closed at</dt>
            <dd className="tabular whitespace-nowrap text-lg font-semibold text-primary sm:mt-2 sm:text-2xl">$73,501</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-2xl border border-border bg-background p-4 sm:flex sm:min-h-[128px] sm:flex-col sm:items-center sm:justify-center sm:text-center">
            <dt className="text-[11px] uppercase leading-snug tracking-wide text-muted-foreground">Outcome</dt>
            <dd className="whitespace-nowrap text-lg font-semibold text-foreground sm:mt-2 sm:text-2xl">Held</dd>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Marion County foreclosure, July 2026. Figures from the published report and the clerk&rsquo;s recorded sale.
          </p>
        </dl>
      </div>
    </section>
  )
}

/* ── Founder (CONTENT_SOP §5.9 N1–N7 · Problem-founder archetype) ─────────── */

export function Founder() {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="grid gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <Eyebrow>Why we built it</Eyebrow>
          <H2>I bid with my own money first.</H2>
          <p className="mt-4 text-sm text-muted-foreground">
            Ariel Shapira · Founder · Developer · Builder · Property Manager · Inventor of ZoneWise.AI · The Real Estate AI Oracle&trade;
          </p>
        </div>
        <div className="space-y-4 text-base leading-7 text-muted-foreground">
          <p>
            Rainsville started as a $5,330 tax deed. After a ground-up build it closed at $398,600 &mdash; both
            figures on the clerk&rsquo;s record. Lakewood was a $28,100 tax deed; it sold at $320,000 with our own
            financing behind it &mdash; deed and closing both recorded. Twenty-plus years of results like these at
            foreclosure and tax deed auctions across Florida, courthouse and online.
          </p>
          <p>
            I earned them in the trenches, in the courthouses and on the job sites &mdash; buying, building and
            managing every property myself. Every one of those lessons is now in the software.
          </p>
          <p className="text-foreground">
            So you can simply talk to Deed. Ask in your own language, and what&rsquo;s coming to auction, what to
            bid, and what the zoning allows become crystal clear &mdash; before you raise your hand. For everyone,
            everywhere, on data that is ours alone.
          </p>
          <p className="text-xs text-muted-foreground">
            Figures from the publicly recorded closings at{' '}
            <a href="https://everestcapitalusa.com" className="underline decoration-border underline-offset-4 hover:text-foreground" rel="noopener">everestcapitalusa.com</a>.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ── How it works ────────────────────────────────────────────────────────── */

const STEPS = [
  {
    icon: MessageSquareText,
    title: 'Ask in plain English',
    body: 'A county, a week, a case number or an address. Deed answers from the live county calendars and shows you the sales as cards you can open.',
  },
  {
    icon: Search,
    title: 'Deed reads the record',
    body: 'Parcel, judgment, plaintiff, prior sales, comparable sales and the zoning code — pulled from the public record and cited line by line.',
  },
  {
    icon: Target,
    title: 'You get the ceiling',
    body: 'A maximum allowable bid, the value band behind it and the flags that would make you walk away. Before you bid online or at the courthouse.',
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6">
      <div className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <H2>OUTBID THE GUESSWORK.</H2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          What&rsquo;s coming to auction, what to bid, and what the zoning allows &mdash; answered before you bid, in
          every Florida county, for foreclosure and tax deed sales alike.
        </p>
      </div>
      <ol className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <li key={s.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="tabular text-xs font-semibold text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.body}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* ── Pricing ─────────────────────────────────────────────────────────────── */

interface Plan {
  name: string
  price: string
  per: string
  blurb: string
  features: string[]
  soon?: string[]
  cta: { label: string; href?: string; prompt?: string }
  featured?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    per: 'forever',
    blurb: 'See what is coming to auction in every county. No card required.',
    features: [
      '30-day snapshot, every county',
      '3 property previews per county',
      'Max-bid range on every preview',
      'Daily email digest',
      'Ask Deed anything',
    ],
    cta: { label: 'Start free', href: '/sign-up' },
  },
  {
    name: 'Investor',
    price: '$99',
    per: '/month',
    blurb: 'The exact ceiling on every lot in your counties.',
    features: [
      'Exact Shapira Max Bid',
      'Unlimited property cards',
      'Plaintiff identity and max-bid intelligence',
      'Outcome scorecard after each sale',
      '3 skip traces a month · 1 county monitor',
    ],
    cta: { label: 'Start Investor', href: W.subscribeInvestor },
    featured: true,
  },
  {
    name: 'Pro',
    price: '$199',
    per: '/month',
    blurb: 'Investor, plus the zoning read on every property.',
    features: [
      'Everything in Investor',
      'Full ZoneWise zoning per property: setbacks, parking, height, land use, units per acre, FAR, permitted uses, overlays',
      '10 SIGNAL$ Property Reports a month',
      '15 skip traces · 3 county monitors',
    ],
    soon: ['Lien stack and title chain'],
    cta: { label: 'Start Pro', href: W.subscribePro },
  },
  {
    name: 'Pro Plus',
    price: '$299',
    per: '/month',
    blurb: 'For teams working several counties at once.',
    features: [
      'Everything in Pro',
      '25 SIGNAL$ Property Reports a month',
      'Entitlement feasibility',
      '50 skip traces · 10 county monitors',
    ],
    soon: ['Due-diligence title report (pre-bid summary, not title insurance)'],
    cta: { label: 'Ask Deed about Pro Plus', prompt: 'I want the Pro Plus plan at $299 a month. How do I subscribe, and what does it include?' },
  },
]

export function Pricing({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="max-w-2xl">
        <Eyebrow>Plans</Eyebrow>
        <H2>Cheaper than one bad bid.</H2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Start free with every county visible. Upgrade when you want the exact ceiling. Or buy one report for one
          property, one time.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={cn(
              'flex flex-col rounded-2xl border bg-card p-6',
              p.featured ? 'border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]' : 'border-border'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
              {p.featured ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">Most chosen</span>
              ) : null}
            </div>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="tabular font-display text-4xl font-medium tracking-tight text-foreground">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.per}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{p.blurb}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm leading-5 text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {f}
                </li>
              ))}
              {p.soon?.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                  <span className="mt-1 inline-block size-2.5 shrink-0 rounded-full border border-border" aria-hidden />
                  <span>
                    {f} <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">soon</span>
                  </span>
                </li>
              ))}
            </ul>
            {p.cta.href ? (
              <a href={p.cta.href} className={cn(p.featured ? BTN_PRIMARY : BTN_QUIET, 'mt-6 w-full')}>
                {p.cta.label}
              </a>
            ) : (
              <button type="button" onClick={() => p.cta.prompt && onPrompt(p.cta.prompt)} className={cn(BTN_QUIET, 'mt-6 w-full')}>
                {p.cta.label}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              One property, one report — SIGNAL$ Property Report, <span className="tabular">$25</span>
            </h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              All 18 sections on a single property: value band, Shapira Max Bid ceiling, comparable sales, zoning read and
              red flags. When the sale closes, you get the outcome scorecard re-issued free.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 sm:shrink-0">
          <a href={W.sampleReport} className={BTN_QUIET}>
            See a sample
          </a>
          <a href={W.buyReport} className={BTN_PRIMARY}>
            Get a report — $25
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Founding investors: the first 100 BidDeed.AI Pioneers set founding pricing.{' '}
        <a href={W.pioneers} className="font-medium text-primary underline underline-offset-2">
          Join the Pioneer waitlist
        </a>
      </p>
    </section>
  )
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

export function Footer() {
  const links = [
    { label: 'All counties', href: W.counties },
    { label: 'Blog', href: W.blog },
    { label: 'Pioneers', href: W.pioneers },
    { label: 'Terms', href: W.terms },
    { label: 'Privacy', href: W.privacy },
    { label: 'Security', href: W.security },
    { label: 'Disclaimer', href: W.disclaimer },
  ]
  return (
    <footer className="mx-auto max-w-6xl border-t border-border px-4 py-10 sm:px-6">
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {l.label}
          </a>
        ))}
      </nav>
      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        BidDeed.AI is an investment decision-support tool. It is not legal advice, not an appraisal and not title
        insurance. Auction data and bid estimates are informational and must be independently verified before you
        bid. Title and lien content is provided for due-diligence purposes only; obtain independent legal advice
        and/or title insurance before relying on it. The underlying method is the subject of a pending provisional
        patent application; nothing here is issued.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} BidDeed.AI · AI-Powered Foreclosure &amp; Tax Deed Auction Intelligence — With Zoning
        Analysis on Every Property
      </p>
    </footer>
  )
}
