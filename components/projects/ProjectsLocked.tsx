import { CheckCircle2, HardHat, Lock, ListChecks, Calculator } from 'lucide-react'
import type { CapabilityCheck } from '@/lib/tier/server'

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  investor: 'Investor',
  pro: 'Pro',
  proplus: 'Pro Plus',
  enterprise: 'Enterprise',
}

const EXAMPLE_LINES = [
  { category: 'Roofing', description: 'Tear-off and re-roof, architectural shingle', total: '$9,062.50' },
  { category: 'Kitchen', description: 'Cabinets, counters and appliances', total: '$11,100.00' },
  { category: 'Flooring', description: 'LVP throughout, supply and install', total: '$7,618.50' },
]

const LOCKED_ITEMS = [
  { icon: Calculator, title: 'Budget builder', body: 'Start from a cosmetic, standard or gut template and edit every line — costs are an editable baseline, not a priced catalog.' },
  { icon: ListChecks, title: 'Scopes of work', body: 'Send selected lines to a contractor, log the bid and see it against budget the moment it comes back.' },
  { icon: HardHat, title: 'Budget vs. actual', body: 'Log spend against the budget as it happens and watch variance and projected gross profit move in real time.' },
]

export default function ProjectsLocked({ check }: { check: CapabilityCheck }) {
  const upgradeLabel = check.upgradeTier ? TIER_LABELS[check.upgradeTier] ?? check.upgradeTier : 'Pro Plus'
  const upgradePriceLabel = check.upgradePrice != null ? `$${Math.round(check.upgradePrice)}` : null
  const subscribeHref = `/subscribe?tier=${check.upgradeTier ?? 'proplus'}`

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Projects</p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        Budget the rehab, price the scopes, track spend against budget.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        You won the auction. Now the real math starts — what does the rehab actually cost, what does each
        trade bid, and how far off budget are you once the invoices land. Projects turns the property you
        just bought into a working budget from day one.
      </p>

      {/* Static example lines — not live data, purely illustrative. */}
      <div className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="text-base font-semibold text-foreground">Example: three lines from a standard rehab</p>
        <ol className="mt-4 divide-y divide-border">
          {EXAMPLE_LINES.map((l) => (
            <li key={l.description} className="flex flex-col gap-2 py-3 text-base sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">{l.category}</span>
                <span className="min-w-0 text-foreground">{l.description}</span>
              </div>
              <span className="shrink-0 pl-10 font-mono text-xs text-primary sm:pl-0">{l.total}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-base text-muted-foreground">
          Real budgets are 12 to 34 editable lines depending on template, grouped by category, with a live
          rollup for subtotal, contingency, total, actual spend, variance and projected gross profit.
        </p>
      </div>

      {/* Locked panel — the upgrade trigger. */}
      <div className="mt-8 rounded-2xl border border-border bg-secondary p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
            <Lock className="size-3" aria-hidden />
            {upgradeLabel}
          </span>
          <span className="text-sm font-semibold text-foreground">
            Projects is included in {upgradeLabel}
            {upgradePriceLabel ? ` — ${upgradePriceLabel}/mo` : ''}
          </span>
        </div>

        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {LOCKED_ITEMS.map((item) => (
            <li key={item.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <item.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-base leading-5 text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={subscribeHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Upgrade to {upgradeLabel}
            {upgradePriceLabel ? ` — ${upgradePriceLabel}/mo` : ''}
          </a>
          <p className="text-base leading-6 text-muted-foreground">
            You are on {TIER_LABELS[check.tierId] ?? check.tierId} today. Construction management is{' '}
            {upgradeLabel} and above.
          </p>
        </div>
      </div>
    </div>
  )
}
