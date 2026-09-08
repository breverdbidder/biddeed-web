'use client'

import './globals.css'
import { clearRebootRetryState, useRebootAwareRetry } from '@/lib/reboot-retry'

// Catches a crash in the root layout itself, so it must render its own
// <html>/<body> and re-import the token stylesheet (this file replaces
// RootLayout entirely — see app/layout.tsx). Same reboot-aware retry as
// app/error.tsx (G-STATES item 2, #20184): silent first, message only after
// repeated failure.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { phase } = useRebootAwareRetry(error, reset)

  return (
    <html lang="en" data-theme="light">
      <body style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
        {phase === 'retrying' ? (
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
              <p className="sr-only" role="status">
                Reconnecting…
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="flex max-w-md flex-col items-center gap-4 text-center">
              <p className="text-base font-semibold text-foreground">BidDeed.AI couldn&apos;t load.</p>
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
        )}
      </body>
    </html>
  )
}
