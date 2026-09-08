import { Skeleton } from '@/components/ui/skeleton'

// Mirrors app/counties/page.tsx: eyebrow + h1 + intro paragraph, then a grid
// of county cards (3 cols lg, 2 cols sm, 1 col mobile) with the same internal
// rows (name row, count line, next-auction line, sale-types line) so the page
// does not jump on hydration.
export default function CountiesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-full max-w-xl sm:h-10" />
      <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-2 h-4 w-3/4 max-w-2xl" />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <li key={i} className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-7 w-20" />
            <Skeleton className="mt-2 h-4 w-32" />
            <Skeleton className="mt-1 h-4 w-24" />
          </li>
        ))}
      </ul>
    </div>
  )
}
