import { SearchX } from 'lucide-react'

interface Props {
  /**
   * Names the exact filter combination that produced zero rows, e.g.
   * "No upcoming auctions in Brevard between Sep 10 and Sep 17." Never a
   * bare "No results" — the point is the reader knows what to change.
   */
  message: string
  /** The single action that widens the filter — clear it, not "browse everything". */
  action: {
    label: string
    onClick: () => void
  }
}

/**
 * One shared empty-state for every filtered list in the app (G-STATES item 3,
 * issue #20184) so the language stays consistent instead of each list
 * inventing its own "no results" copy.
 */
export default function EmptyState({ message, action }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <SearchX className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={action.onClick}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-card px-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
      >
        {action.label}
      </button>
    </div>
  )
}
