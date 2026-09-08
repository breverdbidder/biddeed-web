import { Skeleton } from '@/components/ui/skeleton'

// Mirrors ProjectsWorkspace's default 'Budget' tab: eyebrow + h1, the 5-tab
// strip, the budget picker row, the budget/category summary tiles, and the
// line-item list.
export default function ProjectsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2 h-8 w-full max-w-lg" />

      <div className="mt-6 inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-md" />
        ))}
      </div>

      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <Skeleton className="h-11 w-72" />
          <Skeleton className="h-11 w-36" />
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-secondary p-5 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-6 w-14" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
