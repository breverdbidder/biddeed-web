import type { ReactNode } from 'react'
import { Gavel, Landmark } from 'lucide-react'

interface Props {
  /** Which sale type this callout is about. */
  type: 'tax-deed' | 'foreclosure'
  title?: string
  children: ReactNode
}

const CONFIG = {
  'tax-deed': {
    icon: Landmark,
    kicker: 'Tax deed sale',
    fallbackTitle: 'How tax deed sales differ',
  },
  foreclosure: {
    icon: Gavel,
    kicker: 'Foreclosure auction',
    fallbackTitle: 'How foreclosure auctions differ',
  },
} as const

/**
 * Side-by-side teaching block that keeps the two Florida sale types
 * straight inside a lesson (#63).
 */
export function SaleTypeCallout({ type, title, children }: Props) {
  const { icon: Icon, kicker, fallbackTitle } = CONFIG[type]
  return (
    <aside className="my-6 rounded-xl border border-border bg-card p-5 not-prose">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-primary">
        <Icon aria-hidden className="size-4" />
        {kicker}
      </p>
      <p className="mb-2 text-base font-semibold text-card-foreground">{title ?? fallbackTitle}</p>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </aside>
  )
}
