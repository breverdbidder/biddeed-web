import { CheckCircle2, Lock, MapPinned, Mic, Route } from 'lucide-react'
import type { CapabilityCheck } from '@/lib/tier/server'

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  investor: 'Investor',
  pro: 'Pro',
  proplus: 'Pro Plus',
  enterprise: 'Enterprise',
}

const EXAMPLE_STOPS = [
  { seq: 1, address: '1113 Brook St, Palm Bay', judgment: '$18,400', maxBid: '$14,200' },
  { seq: 2, address: '1099 Moonlight Ct, Palm Bay', judgment: '$21,900', maxBid: '$16,850' },
  { seq: 3, address: '1060 Quail St, Palm Bay', judgment: '$29,700', maxBid: '$22,100' },
]

const LOCKED_ITEMS = [
  { icon: Route, title: 'Build a route', body: 'Pick lots off the auction calendar and order them into a drive.' },
  { icon: MapPinned, title: 'Route map + stop list', body: 'Numbered stops, leg mileage, judgment and SIGNAL$ Max Bid per lot.' },
  { icon: Mic, title: 'Hands-free drive mode', body: 'Mark vacant, occupied, bid, review or skip by voice as you drive.' },
]

export default function D4DLocked({ check }: { check: CapabilityCheck }) {
  const upgradeLabel = check.upgradeTier ? TIER_LABELS[check.upgradeTier] ?? check.upgradeTier : 'Pro'
  const upgradePriceLabel = check.upgradePrice != null ? `$${Math.round(check.upgradePrice)}` : null
  const subscribeHref = `/subscribe?tier=${check.upgradeTier ?? 'pro'}`

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Drive for Dollars</p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        Build a route from the lots you actually want to see.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        The report tells you what to bid. Driving the street tells you what the report cannot — whether
        anyone still lives there, what the roof looks like, and which house nobody has filed on yet. Choose
        your properties off the auction calendar and BidDeed.AI turns them into a drive, read aloud stop by
        stop so you never have to touch the phone.
      </p>

      {/* Static example route — not live data, purely illustrative. */}
      <div className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="text-base font-semibold text-foreground">Example: a 3-stop Palm Bay run</p>
        <ol className="mt-4 divide-y divide-border">
          {EXAMPLE_STOPS.map((s) => (
            <li key={s.seq} className="flex flex-col gap-2 py-3 text-base sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {s.seq}
                </span>
                <span className="min-w-0 text-foreground">{s.address}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pl-10 font-mono text-xs text-muted-foreground sm:shrink-0 sm:pl-0">
                <span>Judgment {s.judgment}</span>
                <span className="text-primary">SIGNAL$ Max Bid {s.maxBid}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-base text-muted-foreground">
          Real routes are ordered nearest-neighbour from your starting point, with mileage and drive-time
          estimates for every leg.
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
            Drive for Dollars is included in {upgradeLabel}
            {upgradePriceLabel ? ` — ${upgradePriceLabel}/mo` : ''}
          </span>
        </div>

        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {LOCKED_ITEMS.map((item) => (
            <li key={item.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <item.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-base font-semibold text-foreground">{item.title}</p>
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
            You are on {TIER_LABELS[check.tierId] ?? check.tierId} today. Route planning and field capture
            are {upgradeLabel} and above.
          </p>
        </div>
      </div>
    </div>
  )
}
