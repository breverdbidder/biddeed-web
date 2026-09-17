'use client'

import { CalendarSearch, Calculator, MapPinned, ShieldAlert, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Chip {
  icon: LucideIcon
  label: string
  prompt: string
}

/**
 * Four suggestion chips (PARITY CP-2 §3). Same questions as the home page's
 * prompt starters — the inventory ones are phrased so lib/deed/intent.ts
 * answers them with live auction cards before the model says a word.
 */
export const CHAT_CHIPS: Chip[] = [
  { icon: CalendarSearch, label: 'This week in Brevard', prompt: "What's selling in Brevard County this week?" },
  {
    icon: MapPinned,
    label: 'Tax deeds under $50k',
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
]

// One static line, server-rendered: a time-of-day greeting would have to be
// computed on the client (the server does not know the customer's clock) and
// swap in after hydration — a visible text change on every load for no gain.
const GREETING = 'What are we bidding on?'

/**
 * The empty conversation (PARITY CP-2 §3): a serif greeting, the composer, and
 * four chips with Lucide icons. No mascot illustration, no language row
 * (language lives in Settings), no stacked "Talk to Deed" bar — the mic in
 * the composer is voice.
 */
export default function ChatEmptyState({
  onPick,
  children,
}: {
  onPick: (prompt: string) => void
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby="deed-chat-greeting"
      className={cn(
        'relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-center px-4 py-10 sm:px-6 sm:py-16',
        'bg-[radial-gradient(60%_50%_at_50%_35%,hsl(var(--primary)/0.08),transparent_70%)]'
      )}
    >
      <div className="mx-auto w-full max-w-3xl">
        <h1
          id="deed-chat-greeting"
          className="font-display text-center text-[2rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-[2.5rem]"
        >
          {GREETING}
        </h1>
        <p className="mt-3 text-center text-base leading-7 text-muted-foreground">
          Deed reads the live county calendars. Ask about a county, a case number or an address — answers cite the record.
        </p>

        <div className="mt-8">{children}</div>

        <ul aria-label="Suggested questions" className="mt-4 flex flex-wrap justify-center gap-2">
          {CHAT_CHIPS.map((c) => {
            const Icon = c.icon
            return (
              <li key={c.label}>
                <button
                  type="button"
                  onClick={() => onPick(c.prompt)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-input bg-card px-3.5 text-sm text-foreground',
                    'transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-primary',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                  )}
                >
                  <Icon className="size-4 text-primary" aria-hidden />
                  {c.label}
                </button>
              </li>
            )
          })}
        </ul>

        <p className="mt-8 text-center text-base leading-6 text-muted-foreground sm:text-[15px]">
          Deed is decision support, not legal, title or financial advice.
        </p>
      </div>
    </section>
  )
}
