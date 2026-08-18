'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatCount, useAuctionCounts } from '@/components/shell/useAuctionCounts'

/**
 * The landing page at '/'.
 *
 * EVERY commercial destination on this page is a Cloudflare Worker route, not
 * an app route. They are plain <a> elements on purpose: next/link would try to
 * resolve /buy-report, /subscribe, /free-report and friends inside the app
 * router, find nothing, and paint a client-side 404 over a page that works
 * perfectly well at the edge. That single mistake would take out the entire
 * conversion funnel while every automated status check stayed green.
 *
 * The only <Link> on this page points at /radar, which really is an app route.
 *
 * Numbers are live from /api/auctions/summary (auctions_summary_ssot()). None
 * are hardcoded. An unknown value renders an em-dash, never a zero: "0 upcoming
 * auctions in Florida" and "the summary endpoint is down" look identical to a
 * visitor and only one of them has ever been true.
 */

// mapbox-gl needs window and must not render during SSR.
const HeroMap = dynamic(() => import('./HeroMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full animate-pulse rounded-xl border border-slate-800 bg-[#0b1220] sm:h-[380px] lg:h-[440px]" />
  ),
})

/** Worker-served. Never a <Link>. */
const W = {
  buyReport: '/buy-report',
  freeReport: '/free-report',
  subscribeInvestor: '/subscribe?tier=investor',
  subscribePro: '/subscribe?tier=pro',
  counties: '/counties',
  blog: '/blog',
  chat: '/chat',
  pioneers: '/pioneers',
  terms: '/terms',
  privacy: '/privacy',
  security: '/security',
  disclaimer: '/disclaimer',
  // Published by the Worker itself inside /section18-teaser. A sample, not a
  // customer credential.
  sampleReport:
    '/report/cad5d07a-b9c7-433d-b365-3165637b7cbe?key=bd_live_S9KLXyeH9fV1epdliLz731n1',
}

const SOLID =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-bd-orange px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-bd-orange-300'
const OUTLINE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white'

export default function Landing() {
  const counts = useAuctionCounts()

  const stats = [
    {
      value: formatCount(counts.total),
      label: 'Auction records tracked',
      source: 'auctions_summary_ssot() · total',
    },
    {
      value: formatCount(counts.upcoming),
      label: 'Upcoming auctions',
      source: 'auctions_summary_ssot() · upcoming',
    },
    {
      value: formatCount(counts.counties),
      label: 'Florida counties covered',
      source: 'auctions_summary_ssot() · counties',
    },
  ]

  return (
    <div className="min-w-0">
      {/* ── Funnel nav ─────────────────────────────────────────────────── */}
      <nav
        aria-label="Primary"
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-800 px-4 py-3 sm:px-6"
      >
        <a href={W.counties} className="text-sm font-medium text-slate-400 hover:text-white">
          Counties
        </a>
        <a href={W.blog} className="text-sm font-medium text-slate-400 hover:text-white">
          Blog
        </a>
        <a href={W.chat} className="text-sm font-medium text-slate-400 hover:text-white">
          Chat
        </a>
        <a href={W.pioneers} className="text-sm font-medium text-slate-400 hover:text-white">
          Pioneers
        </a>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <a
            href={W.subscribeInvestor}
            className="whitespace-nowrap text-sm font-semibold text-slate-300 hover:text-white"
          >
            Investor $99/mo
          </a>
          <a href={W.buyReport} className={`${SOLID} whitespace-nowrap`}>
            GET A REPORT — $25
          </a>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
          <div className="min-w-0">
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              Auction Intelligence
            </Badge>

            <h1 className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-[2.9rem]">
              Florida auctions close in minutes.
              <br />
              You get one number to be right about.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              BidDeed.AI is an agentic AI ecosystem for Florida foreclosure and tax deed sales. It
              reads the calendar, pulls the parcel, prices the risk and hands you a maximum
              allowable bid before the clerk opens the file. Every figure traces to a row you can
              open.
            </p>

            <p className="mt-4 text-base font-semibold text-bd-orange">
              Built by the developer, not sold to him.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href={W.freeReport} className={SOLID}>
                Check Your County Free <ArrowRight className="size-4" />
              </a>
              <a href={W.sampleReport} className={OUTLINE}>
                See a live sample report <ArrowRight className="size-4" />
              </a>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              No credit card for the county check. 12 provisional patent claims pending.
            </p>

            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-slate-800 bg-[#0b1220] p-4"
                  title={stat.source}
                >
                  <dd className="tabular text-2xl font-bold text-white">{stat.value}</dd>
                  <dt className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-slate-600">
              Live from <span className="font-mono">/api/auctions/summary</span> →{' '}
              <span className="font-mono">auctions_summary_ssot()</span>. Em-dash means the endpoint
              has not answered — never a stand-in number.
            </p>
          </div>

          {/* The hero IS the product. Same renderer, same feed as /radar. */}
          <div className="min-w-0">
            <HeroMap />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href="/radar" className={SOLID}>
                Open the workspace <ArrowRight className="size-4" />
              </Link>
              <span className="text-xs text-slate-500">
                Map, calendar, table and spreadsheet over the same rows.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof ──────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-800 bg-[#0b1220] px-4 py-10 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bd-orange">
          Published before the sale. Captured after it.
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">The ceiling held.</h2>
        <div className="mt-5 grid max-w-3xl gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-[#020617] p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Shapira max bid</p>
            <p className="tabular mt-1 text-2xl font-bold text-white">$82,000</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#020617] p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Sale closed at</p>
            <p className="tabular mt-1 text-2xl font-bold text-bd-orange">$73,501</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#020617] p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Outcome</p>
            <p className="mt-1 text-2xl font-bold text-white">Ceiling held</p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-slate-400">
          Marion County, 20 July 2026. Case 422021CA000414CAAXXX. The number was on the record
          before the gavel, not reconstructed after it.
        </p>
        <div className="mt-5">
          <a href={W.sampleReport} className={OUTLINE}>
            Open the full sample report <ArrowRight className="size-4" />
          </a>
        </div>
      </section>

      {/* ── What Clear to Bid is ───────────────────────────────────────── */}
      <section className="px-4 py-10 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          The category is Auction Intelligence
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
          Clear to Bid is the $27 product.
        </h2>
        <p className="mt-3 max-w-2xl text-base text-slate-400">
          Seven days, one chapter a day, the county matrix and the max-bid worksheet. It is the
          system the agents run on, written down so you can run it yourself.
        </p>
        <ul className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
          {[
            'All 67 Florida counties scored, not just the easy ones',
            'The Shapira Formula as a live worksheet, not a diagram',
            'Every number cites the row or endpoint it came from',
            'Redemption, liens and title risk stated before you bid',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
              <Check className="mt-0.5 size-4 shrink-0 text-bd-orange" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={W.buyReport} className={SOLID}>
            Get S5 Report — $25 <ArrowRight className="size-4" />
          </a>
          <a href={W.freeReport} className={OUTLINE}>
            Check Your County Free <ArrowRight className="size-4" />
          </a>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section
        id="pricing"
        className="border-t border-slate-800 bg-[#0b1220] px-4 py-10 sm:px-6"
      >
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Cheaper than one bad bid.</h2>
        <p className="mt-2 text-sm text-slate-400">
          One wrong number at the courthouse costs more than a year of Investor.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col rounded-xl border border-slate-800 bg-[#020617] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              S5 Single Report
            </p>
            <p className="tabular mt-2 text-3xl font-extrabold text-white">
              $25 <span className="text-sm font-medium text-slate-500">one-time</span>
            </p>
            <p className="mt-3 flex-1 text-sm text-slate-400">
              All 18 sections on one property, with the zoning read and the max-bid ceiling. Free
              scorecard re-issue when the outcome lands.
            </p>
            <a href={W.buyReport} className={`${SOLID} mt-5 w-full`}>
              Get S5 Report — $25
            </a>
          </div>

          <div className="flex flex-col rounded-xl border border-bd-orange/50 bg-[#020617] p-5 ring-1 ring-bd-orange/20">
            <p className="text-xs font-bold uppercase tracking-wide text-bd-orange">
              Investor · most chosen
            </p>
            <p className="tabular mt-2 text-3xl font-extrabold text-white">
              $99 <span className="text-sm font-medium text-slate-500">/mo</span>
            </p>
            <p className="mt-3 flex-1 text-sm text-slate-400">
              Every lot in your counties&rsquo; upcoming sales, the daily digest, plaintiff intel
              and the agent working the list beside you.
            </p>
            <a href={W.subscribeInvestor} className={`${SOLID} mt-5 w-full`}>
              Start Investor
            </a>
          </div>

          <div className="flex flex-col rounded-xl border border-slate-800 bg-[#020617] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pro</p>
            <p className="tabular mt-2 text-3xl font-extrabold text-white">
              $199 <span className="text-sm font-medium text-slate-500">/mo</span>
            </p>
            <p className="mt-3 flex-1 text-sm text-slate-400">
              Everything in Investor, plus full scoring probabilities, the feature drivers behind
              them, and direct API access.
            </p>
            <a href={W.subscribePro} className={`${OUTLINE} mt-5 w-full`}>
              Start Pro
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-bd-orange/25 bg-bd-orange/5 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-bd-orange">
            Pioneer program — waitlist open
          </p>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            The first 100 BidDeed.AI Pioneers set founding pricing and get early access to each
            agent as it ships.
          </p>
          <a href={W.pioneers} className={`${OUTLINE} mt-4`}>
            Join the waitlist
          </a>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-4 py-8 sm:px-6">
        <p className="max-w-3xl text-xs leading-relaxed text-slate-500">
          BidDeed.AI is an investment decision-support tool. It is not legal advice, not an
          appraisal and not title insurance. Auction data and bid estimates are informational and
          must be independently verified before you bid. Ariel Shapira is the founder and developer
          of BidDeed.AI; he is not a licensed general contractor and nothing here is a construction
          or engineering opinion. The underlying method is the subject of 12 provisional patent
          claims, pending — nothing here is issued.
        </p>
        <nav aria-label="Legal" className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <a href={W.terms} className="text-xs font-medium text-slate-400 hover:text-white">
            Terms
          </a>
          <a href={W.privacy} className="text-xs font-medium text-slate-400 hover:text-white">
            Privacy
          </a>
          <a href={W.security} className="text-xs font-medium text-slate-400 hover:text-white">
            Security
          </a>
          <a href={W.disclaimer} className="text-xs font-medium text-slate-400 hover:text-white">
            Disclaimer
          </a>
          <a href={W.counties} className="text-xs font-medium text-slate-400 hover:text-white">
            All counties
          </a>
          <a href={W.blog} className="text-xs font-medium text-slate-400 hover:text-white">
            Blog
          </a>
        </nav>
        <p className="mt-5 text-xs text-slate-600">
          © {new Date().getFullYear()} BidDeed.AI · Florida foreclosure and tax deed Auction
          Intelligence
        </p>
      </footer>
    </div>
  )
}
