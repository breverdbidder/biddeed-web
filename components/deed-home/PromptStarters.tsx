'use client'

import { CalendarSearch, Calculator, GraduationCap, MapPinned, ShieldAlert, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Starter {
  icon: LucideIcon
  label: string
  prompt: string
}

/**
 * Prompt starters. Each one is a real question a Florida auction investor asks
 * in the week before a sale, phrased so the intent parser (lib/deed/intent.ts)
 * can answer the inventory ones with cards.
 */
export const STARTERS: Starter[] = [
  {
    icon: CalendarSearch,
    label: 'This week in Brevard',
    prompt: "What's selling in Brevard County this week?",
  },
  {
    icon: MapPinned,
    label: 'Tax deeds this month',
    prompt: 'Show me upcoming tax deed auctions in Polk County this month under $50k',
  },
  {
    icon: Calculator,
    label: 'How the max bid works',
    prompt: 'How does BidDeed decide the maximum bid on a property, and what should I check before I trust it?',
  },
  {
    icon: ShieldAlert,
    label: 'What survives the sale',
    prompt: 'Which liens survive a Florida tax deed sale versus a foreclosure sale?',
  },
  {
    icon: GraduationCap,
    label: 'Foreclosure vs tax deed',
    prompt: 'What is the difference between a foreclosure auction and a tax deed auction in Florida, for a first-time bidder?',
  },
]

// Audit P2-12: pills previously scrolled off-canvas on mobile with no scroll
// affordance (hidden scrollbar, no fade) - wrap to two lines instead, same as
// the desktop treatment.
export default function PromptStarters({
  onPick,
  className,
}: {
  onPick: (prompt: string) => void
  className?: string
}) {
  return (
    <ul
      aria-label="Suggested questions"
      className={cn(
        'flex flex-wrap justify-center gap-2 pb-1',
        className
      )}
    >
      {STARTERS.map((s) => {
        const Icon = s.icon
        return (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onPick(s.prompt)}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-input bg-card px-3.5 text-sm text-foreground',
                'transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-primary',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              )}
            >
              <Icon className="size-4 text-primary" aria-hidden />
              {s.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
