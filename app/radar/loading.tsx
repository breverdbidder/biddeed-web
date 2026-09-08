import { Skeleton } from '@/components/ui/skeleton'

// Mirrors AuctionsLayout's default 'split' view: header, the 5-tile
// AuctionSummaryCards row, the filter bar, then a fixed-height row with the
// sidebar list on the left and the map on the right (stacked on mobile).
export default function RadarLoading() {
  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-muted dark:bg-background">
      <div className="mx-auto max-w-7xl min-w-0 space-y-6 px-4 py-6 sm:px-6">
        <div>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-8 w-12" />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-11 w-64" />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:h-[70vh] lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="order-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:order-1 lg:h-auto">
            <div className="border-b border-border px-3 py-2">
              <Skeleton className="h-3 w-24" />
            </div>
            <ul className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="px-3 py-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 min-h-[280px] min-w-0 h-[45vh] lg:order-2 lg:h-auto">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
