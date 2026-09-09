import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

interface Props {
  /** Real in-app or Worker route only — verify against the repo before adding one. */
  href: string
  label: string
  title?: string
  children?: ReactNode
}

/**
 * End-of-lesson call to action (#63). Every public Academy lesson closes with
 * at least one of these pointing at a real route (/discover, /radar,
 * /buy-report, /counties, /subscribe, ...).
 *
 * A plain <a>, not next/link: several valid targets (e.g. /buy-report) are
 * served by the Worker, and a client-side transition into a route the app
 * router does not own paints a 404 over a live page — same rule as
 * `external: true` in components/shell/nav.ts.
 */
export function BidDeedCTA({ href, label, title, children }: Props) {
  return (
    <div className="my-6 rounded-xl border border-border bg-secondary p-5 not-prose">
      {title ? <p className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-primary">{title}</p> : null}
      {children ? <div className="mb-3 text-sm leading-6 text-secondary-foreground">{children}</div> : null}
      <a
        href={href}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground no-underline transition-colors hover:bg-primary-hover"
      >
        {label}
        <ArrowRight aria-hidden className="size-4" />
      </a>
    </div>
  )
}
