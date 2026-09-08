'use client'

import { clearRebootRetryState, useRebootAwareRetry } from '@/lib/reboot-retry'

// Root error boundary (G-STATES item 2, #20184): silent auto-retry first,
// message only after repeated failure. See lib/reboot-retry.ts for why.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { phase } = useRebootAwareRetry(error, reset)

  if (phase === 'retrying') {
    // Same visual treatment as every other loading state in the app (e.g.
    // AuctionsLayout's own spinner) — nothing that reads as an error while
    // this is still very likely a routine Supabase reboot.
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
          <p className="sr-only" role="status">
            Reconnecting…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-base font-semibold text-foreground">This page couldn&apos;t load.</p>
        <p className="text-sm text-muted-foreground">
          We tried a few times and it&apos;s still not responding. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => {
            clearRebootRetryState()
            reset()
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
