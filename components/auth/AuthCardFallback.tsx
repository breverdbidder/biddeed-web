import { Skeleton } from '@/components/ui/skeleton'

/**
 * The sign-in / sign-up card while Clerk's script loads (the `fallback` of
 * <SignIn> and <SignUp>, replaced by Clerk's card when it mounts). It carries
 * the page's h1, in the same words as the Clerk card's own title, so the page
 * has its heading from the first byte and never more than one.
 *
 * Measured 28 Sep 2026 on biddeed.ai: Clerk's card, and with it the page's only
 * h1, mounted 1-4 s after DOMContentLoaded, while the page itself showed just
 * the logo. The post-deploy audit reads the page 1 s in, so its SEO gate went
 * red on /sign-in and /sign-up at both widths (4 red cells).
 */
export default function AuthCardFallback({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-lg" aria-busy="true">
      <h1 className="text-lg font-bold text-foreground">{title}</h1>
      <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>
      <div className="mt-6 space-y-3" aria-hidden="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <p className="sr-only" role="status">
        Loading the form
      </p>
    </div>
  )
}
