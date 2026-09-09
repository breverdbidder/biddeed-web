import { CheckSquare } from 'lucide-react'

interface Props {
  title?: string
  items: string[]
}

/**
 * Due-diligence style checklist (#63). Static content — the interactive
 * per-user progress state belongs to the later free-account tier, so this
 * renders as a styled list for now.
 */
export function Checklist({ title = 'Checklist', items }: Props) {
  return (
    <div className="my-6 rounded-xl border border-border bg-card p-5 not-prose">
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-primary">{title}</p>
      <ul className="m-0 list-none space-y-2 p-0">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-6 text-card-foreground">
            <CheckSquare aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
