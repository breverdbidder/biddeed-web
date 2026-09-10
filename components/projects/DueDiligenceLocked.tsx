import { CheckCircle2, Lock, PlaneTakeoff } from 'lucide-react'

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  investor: 'Investor',
  pro: 'Pro',
  proplus: 'Pro Plus',
  enterprise: 'Enterprise',
}

// Inline upgrade prompt for the Due Diligence tab — same visual language as
// ProjectsLocked/D4DLocked, sized to sit inside a tab panel rather than take
// over the page (the rest of Projects is already reachable at this tier).
export default function DueDiligenceLocked({ tierId }: { tierId: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-secondary p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
          <Lock className="size-3" aria-hidden />
          Pro Plus
        </span>
        <span className="text-sm font-semibold text-foreground">Due Diligence is included in Pro Plus</span>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <PlaneTakeoff className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">Aerial tour + property assessment</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            An aerial flyover, street-level imagery and a structured condition read — roof, structure, lot and
            visible defects — for every property you win, before you finalize the budget.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href="/subscribe?tier=proplus"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Upgrade to Pro Plus
        </a>
        <p className="text-base leading-6 text-muted-foreground">
          You are on {TIER_LABELS[tierId] ?? tierId} today. Due Diligence is Pro Plus and above.
        </p>
      </div>
    </div>
  )
}
