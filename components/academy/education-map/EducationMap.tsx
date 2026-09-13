import { GraduationCap, Lock, ArrowRight, ArrowDown } from 'lucide-react'
import { getCallerTierId, tierAtLeast } from '@/lib/tier/server'
import { RankTable, SatisfactionPill, type RankRow } from './RankTable'
import data from '@/content/education-map.json'

/**
 * Education map (#education-map, Part D of content/briefs/education-map-2026-09-12.md).
 *
 * Public: hero, methodology, ranked candidate table, platform rank, disclaimer.
 * Investor+: full scorecards beyond the top 3, the CDA deep dive, and the
 * project-card template download. Tier resolves through lib/tier/server's
 * getCallerTierId (resolve_user_tier RPC) — fails closed to 'free', which is
 * the right failure mode for a content gate.
 *
 * Palette-gate compliant: token classes only, no colour literals.
 */

interface Candidate {
  id: string
  name: string
  operator: string
  category: string
  rank: number
  score: number
  price_low: number | null
  price_high: number | null
  price_recurring: number | null
  price_period: string | null
  price_note: string
  guarantee_days: number | null
  guarantee_note: string
  satisfaction: string
  satisfaction_note: string
  proof_type: string
  platforms: { name: string; handle?: string; role?: string; url?: string; grade?: string }[]
  best_platform: string
  fit_for_biddeed_user: string
  biddeed_take: string
}

const CATEGORY_LABELS: Record<string, string> = {
  'ground-up-education': 'Ground-up school',
  'product-niche': 'Product niche',
  'cheap-diy': 'Library / DIY',
  'credential': 'Credential',
  'adjacent-list-steal': 'Creative finance',
  'jv-school': 'JV school',
  'guru-seminar': 'Seminar machine',
}

const PROOF_LABELS: Record<string, string> = {
  'building-catalog': 'Named buildings',
  'peer-authority': 'Named peers',
  'founder-process': 'Founder process',
  'local-code-specificity': 'Local code fit',
  'ugc-forums': 'Community forums',
  'academic-credential': 'Credential',
  'student-volume-theater': 'Student volume',
  'long-lived-seo': 'Legacy SEO',
  'stage-testimonials': 'Stage testimonials',
}

const SAT_SORT: Record<string, number> = { 'S+': 0, 'S': 1, 'S-': 2, 'M': 3, 'W/M': 4, 'W': 5, 'n/a': 6 }

function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

function priceBand(c: Candidate): { label: string; sort: number } {
  if (c.price_low == null && c.price_high == null) return { label: 'Not public', sort: 999999 }
  if (c.price_low === 0 && c.price_recurring) return { label: `Free - ${money(c.price_recurring)}/mo`, sort: c.price_recurring }
  if (c.price_low === c.price_high && c.price_low != null) return { label: money(c.price_low), sort: c.price_low }
  const lo = c.price_low ?? 0
  const hi = c.price_high ?? lo
  const band = `${money(lo)} - ${money(hi)}`
  return { label: c.price_recurring ? `${band} + ${money(c.price_recurring)}/${c.price_period}` : band, sort: lo }
}

function LockedBlock({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
        <Lock aria-hidden className="size-4" />
        {label}
      </div>
      {children ? <div className="mt-2 text-sm text-muted-foreground">{children}</div> : null}
      <a
        href="/subscribe"
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground no-underline transition-colors hover:bg-primary-hover"
      >
        Upgrade to Investor to open the map
        <ArrowRight aria-hidden className="size-4" />
      </a>
    </div>
  )
}

export async function EducationMap() {
  const tierId = await getCallerTierId()
  const isInvestor = tierAtLeast(tierId, 'investor')

  const candidates = [...(data.candidates as Candidate[])].sort((a, b) => a.rank - b.rank)
  const rows: RankRow[] = candidates.map((c) => {
    const band = priceBand(c)
    return {
      rank: c.rank,
      name: c.name,
      operator: c.operator,
      categoryLabel: CATEGORY_LABELS[c.category] ?? c.category,
      score: c.score,
      priceBand: band.label,
      priceSort: band.sort,
      satisfaction: c.satisfaction,
      satisfactionSort: SAT_SORT[c.satisfaction] ?? 9,
      proofLabel: PROOF_LABELS[c.proof_type] ?? c.proof_type,
      bestPlatform: c.best_platform,
      take: c.biddeed_take,
    }
  })
  const takeByName = Object.fromEntries(candidates.map((c) => [c.name, c.biddeed_take]))

  const publicCards = candidates.slice(0, 3)
  const gatedCards = candidates.slice(3)
  const cda = candidates.find((c) => c.id === 'cda')!

  return (
    <div className="not-prose flex flex-col gap-10">
      {/* Hero — copy deck verbatim from the brief */}
      <section className="rounded-xl border border-border bg-secondary p-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Academy</p>
        <h2 className="mt-1 text-2xl font-extrabold text-secondary-foreground">
          Schools that teach building vs schools that teach buying.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          We ranked the offers auction operators actually run into — Cashflow Developer Academy,
          Rookie Redeveloper, Bright Build, SubTo, FortuneBuilders, BiggerPockets — on proof, price,
          and complaint load.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/radar"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground no-underline transition-colors hover:bg-primary-hover"
          >
            View live auctions
            <ArrowRight aria-hidden className="size-4" />
          </a>
          <a
            href="#methodology"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-muted"
          >
            How BidDeed grades education
            <ArrowDown aria-hidden className="size-4" />
          </a>
        </div>
      </section>

      {/* Methodology (C1) */}
      <section id="methodology">
        <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground">
          <GraduationCap aria-hidden className="size-5 text-primary" />
          How we grade
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Weighted for BidDeed&apos;s actual user — the auction and distressed-property operator who
          might later develop or rehab. Satisfaction grades are composite analyst grades, not a
          single official score; public review sources conflict. Treat them as directional.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-left">
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">Weight</th>
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">Criterion</th>
              </tr>
            </thead>
            <tbody>
              {data.methodology.map((m) => (
                <tr key={m.criterion} className="border-t border-border">
                  <td className="px-3 py-2 font-bold text-primary">{m.weight}%</td>
                  <td className="px-3 py-2 text-muted-foreground">{m.criterion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ranked candidate table (C2) */}
      <section>
        <h3 className="mb-1 text-lg font-bold text-foreground">The ranking</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          #1 is not the biggest brand. #1 is the best-run offer for someone who wants to build.
        </p>
        <RankTable rows={rows} takeByName={takeByName} />
      </section>

      {/* Scorecards */}
      <section>
        <h3 className="mb-3 text-lg font-bold text-foreground">Scorecards</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {publicCards.map((c) => (
            <Scorecard key={c.id} c={c} />
          ))}
          {isInvestor ? (
            gatedCards.map((c) => <Scorecard key={c.id} c={c} />)
          ) : (
            <LockedBlock label={`${gatedCards.length} more scorecards are Investor tier`}>
              Full price notes, guarantee terms, platform grades, and the BidDeed take for every
              candidate below the top 3.
            </LockedBlock>
          )}
        </div>
      </section>

      {/* CDA deep dive (gated) */}
      <section>
        <h3 className="mb-3 text-lg font-bold text-foreground">Deep dive: Cashflow Developer Academy</h3>
        {isInvestor ? (
          <details className="rounded-xl border border-border bg-card p-5">
            <summary className="cursor-pointer text-sm font-bold text-foreground">
              Offer, funnel anatomy, grades, and the project-card template
            </summary>
            <div className="mt-4 flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">The offer</p>
                <p>
                  Cashflow Developer Academy by Daniil Kleyman (True Vision Analytics / Rehab
                  Valuator). Headline promise: properties that pay you for life, with a
                  $50k/month cashflow hook. Launch price {money(cda.price_low!)} against a{' '}
                  {money(cda.price_high!)} anchor, or 2 x $1,950, then {money(cda.price_recurring!)}/yr
                  renewal after 12 months. 30-day unconditional refund. Partner or spouse seat free.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">What is inside</p>
                <p>
                  3-4 courses / 110+ lessons (pre-development, development, post-development), a
                  contracts-and-checklists resource library, bi-weekly live calls and deal reviews
                  with Daniil, a member community with a Near Me directory, guest trainers, and 2-3
                  Richmond live events per year.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Funnel anatomy</p>
                <p>
                  VSL launch page, first-100-spots scarcity with a live counter, an $18,900 bonus
                  value stack, dual beginner/scaler FAQ, mid-ticket Infusionsoft checkout. The
                  launch-4 slug means this page has been recycled through at least four launches.
                  Grades from the analysis: offer-market fit B+, copy B, proof C- (no student
                  artifacts on the page), page craft C, ethics yellow — a real operator in guru
                  packaging.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Where it wins and where it is exposed</p>
                <p>
                  Wins: founder process on YouTube, the Rehab Valuator software moat, fairest
                  mid-ticket price in the direct set, the strongest guarantee. Exposed: almost no
                  on-page student artifacts, the $50k/mo hook, and ADU specialists stealing the
                  easiest first project.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Project-card template</p>
                <p>
                  The proof format development buyers actually trust: photo, product type, stage
                  pill, one number only, capital stack, status, attribution. No projected IRR, no
                  bonus-value math.
                </p>
                <a
                  href="/academy/assets/cda-project-card-template.md"
                  download
                  className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground no-underline transition-colors hover:bg-muted"
                >
                  Download the template (markdown)
                  <ArrowDown aria-hidden className="size-4" />
                </a>
              </div>
              <p className="text-xs">
                Source:{' '}
                <a
                  href="https://lp.rehabvaluator.com/cashflow-developer-academy-launch-4/"
                  rel="nofollow sponsored"
                  className="text-primary underline"
                >
                  CDA launch page
                </a>{' '}
                and the BidDeed competitive intel brief (2026-09-12).
              </p>
            </div>
          </details>
        ) : (
          <LockedBlock label="The CDA deep dive is Investor tier">
            Offer anatomy, funnel grades, the exposure map, and the downloadable project-card
            template.
          </LockedBlock>
        )}
      </section>

      {/* Platform rank (C3) */}
      <section>
        <h3 className="mb-1 text-lg font-bold text-foreground">Where these schools actually acquire buyers</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Platforms ranked as acquisition channels for a $3k-$20k education buyer, not by vanity
          reach.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-left">
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">#</th>
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">Platform</th>
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">Why it ranks</th>
                <th className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">Used best by</th>
              </tr>
            </thead>
            <tbody>
              {data.platform_rank.map((p) => (
                <tr key={p.rank} className="border-t border-border">
                  <td className="px-3 py-2 font-bold text-primary">{p.rank}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{p.platform}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.why}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.best_user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Disclaimer (prominent, per the produce-the-instrument rule) */}
      <section className="rounded-xl border border-border bg-muted p-5">
        <p className="text-sm font-bold text-foreground">Read this before using the ranking</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This map is not an endorsement of any school, and BidDeed is not ranked in it — BidDeed
          is data, max-bid, zoning and construction software, not a course. Prices change, review
          sources conflict, and every satisfaction grade above is a composite analyst grade, not an
          official score. Nothing here is investment advice. Development and foreclosure bidding
          both lose money when the homework is wrong. Verify current pricing and terms on each
          vendor&apos;s own page before spending a dollar.
        </p>
      </section>
    </div>
  )
}

function Scorecard({ c }: { c: Candidate }) {
  const band = priceBand(c)
  const fit = c.fit_for_biddeed_user
  return (
    <details className="rounded-xl border border-border bg-card p-5">
      <summary className="cursor-pointer">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
          {c.rank <= 3 ? (
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {c.rank}
            </span>
          ) : (
            <span className="inline-flex size-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">
              {c.rank}
            </span>
          )}
          {c.name}
        </span>
        <span className="ml-2 align-middle"><SatisfactionPill grade={c.satisfaction} /></span>
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {c.operator} · {band.label}
          {c.guarantee_days ? ` · ${c.guarantee_days}-day refund` : ''}
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
        <p><span className="font-semibold text-foreground">Price: </span>{c.price_note}</p>
        <p><span className="font-semibold text-foreground">Guarantee: </span>{c.guarantee_note}</p>
        <p><span className="font-semibold text-foreground">Satisfaction: </span>{c.satisfaction_note}</p>
        <div>
          <p className="font-semibold text-foreground">Platforms</p>
          <ul className="mt-1 list-disc pl-5">
            {c.platforms.map((p) => (
              <li key={p.name}>
                {p.url ? (
                  <a href={p.url} rel="nofollow sponsored" className="text-primary underline">{p.name}</a>
                ) : (
                  p.name
                )}
                {p.handle ? ` ${p.handle}` : ''}
                {p.grade ? ` — ${p.grade}` : ''}
              </li>
            ))}
          </ul>
        </div>
        <p>
          <span className="font-semibold text-foreground">Fit for an auction investor: </span>
          <span className="font-bold text-primary">{fit.charAt(0).toUpperCase() + fit.slice(1)}</span>
        </p>
        <p><span className="font-semibold text-foreground">BidDeed take: </span>{c.biddeed_take}</p>
      </div>
    </details>
  )
}
