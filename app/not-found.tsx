import Link from 'next/link'

// Same calm visual language as app/error.tsx (G-STATES item 2, #20184) —
// this is a routine wrong-URL, not a system failure, so no retry logic.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-base font-semibold text-foreground">We couldn&apos;t find that page.</p>
        <p className="text-sm text-muted-foreground">
          The link may be out of date, or the page may have moved.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Back to BidDeed.AI
        </Link>
      </div>
    </div>
  )
}
