import { Skeleton } from '@/components/ui/skeleton'

// Mirrors app/maps/page.tsx: title row, layer panel, then map+scorecard grid.
export default function MapsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-64" />
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
