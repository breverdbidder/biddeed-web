import { Skeleton } from '@/components/ui/skeleton'

// Mirrors DiscoveryPage: eyebrow + h1 + intro, the search form row, the
// 3-column coverage/upcoming/evidence row, and a results table shape so the
// page does not jump once the client component mounts and searches.
export default function DiscoverLoading() {
  return (
    <section className="min-h-full bg-background px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-10 w-full max-w-2xl" />
          <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
        </div>

        <div className="mt-8 flex flex-col gap-3 border-y border-border py-5 lg:flex-row">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 lg:w-48" />
          <Skeleton className="h-12 lg:w-48" />
          <Skeleton className="h-12 w-28" />
        </div>

        <div className="grid gap-4 border-b border-border py-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-1 h-4 w-32" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 hidden sm:block">
          <Skeleton className="mb-3 h-6 w-56" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
        <div className="mt-8 space-y-3 sm:hidden">
          <Skeleton className="h-6 w-56" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border bg-card p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
