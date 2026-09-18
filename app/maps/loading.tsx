import { Skeleton } from '@/components/ui/skeleton'

// Mirrors app/maps/page.tsx: title row, layer panel, then map+scorecard grid.
// The title is the real <h1>, not a skeleton: page.tsx is force-dynamic and
// awaits the entitlement check before its body streams, so for the first
// few hundred ms the document has <head> metadata and this fallback only.
// The hosted eight-gate audit (runs 35267340369, 35293963982) evaluated
// /maps at 1440 in that window and scored SEO red for "0 h1". Suspense swaps
// this fallback for the page, so there is exactly one h1 at every moment.
export default function MapsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-medium text-foreground sm:text-xl">Florida Auction Intelligence Map</h1>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-11 w-full rounded-lg" />
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-[46vh] w-full rounded-lg sm:h-[60vh] lg:h-[70vh]" />
        <Skeleton className="hidden h-[70vh] w-full rounded-lg sm:block" />
      </div>
    </div>
  )
}
