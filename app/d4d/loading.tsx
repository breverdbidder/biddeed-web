import { Skeleton } from '@/components/ui/skeleton'

// Mirrors D4DWorkspace's default 'Build' tab: eyebrow + h1, the 3-tab strip,
// the county/from/to filter row, and the candidate-lot list.
export default function D4DLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-2 h-8 w-full max-w-lg" />

      <div className="mt-6 inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-end gap-3">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-40" />
          </div>
          <Skeleton className="mt-4 h-4 w-40" />
          <div className="mt-2 divide-y divide-border rounded-lg border border-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-4 shrink-0 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-1 h-11 w-full" />
          </div>
          <div>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-4 w-40" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  )
}
