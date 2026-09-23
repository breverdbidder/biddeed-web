import type { Metadata } from 'next'

import DeveloperKeysPanel from '@/components/account/DeveloperKeysPanel'
import { EMPTY_LISTING, loadListing, requireDeveloperContext, type KeyListing } from '@/lib/developer-keys/server'

/**
 * /account/developers: self-serve MCP API keys (PARITY CP-8 / D12).
 *
 * Before this page a subscriber could only get an MCP key by email or from a
 * trial signup, and the MCP's own 401 pointed at a page with no keys on it.
 * Here they can see their key (prefix only), replace it, revoke it, and copy a
 * working config for Claude Code, Cursor or Claude Desktop.
 *
 * The first render is server-side with the same RPC the API route uses, so the
 * page opens with the real key list rather than a spinner.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'API keys — BidDeed.AI',
  description: 'Create, replace and revoke your BidDeed.AI MCP API key, and connect it to Claude or Cursor.',
  alternates: { canonical: 'https://biddeed.ai/account/developers' },
  robots: { index: false, follow: false },
}

const SHELL = 'mx-auto w-full max-w-5xl px-4 pb-28 pt-10 sm:px-6 sm:pb-16 lg:px-8'
const CTA =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
const CTA_QUIET =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-5 text-sm font-semibold text-secondary-foreground outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export default async function DevelopersPage() {
  const context = await requireDeveloperContext('full')

  if (!context.ok && context.status === 401) {
    return (
      <div className={SHELL}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Developers</p>
        <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
          Sign in to manage your API key.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Your MCP API key connects BidDeed.AI to Claude, Cursor or your own agent. It lives behind
          your sign-in. If you bought an API plan with an email address, sign in with that same
          address and your key will show up here.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/sign-in?redirect_url=/account/developers" className={CTA}>
            Sign in
          </a>
          <a href="/pricing" className={CTA_QUIET}>
            See the plans
          </a>
        </div>
      </div>
    )
  }

  let listing: KeyListing = EMPTY_LISTING
  let loadError: string | null = context.ok ? null : context.error
  if (context.ok) {
    const loaded = await loadListing(context.supabase, context.userId, context.email).catch(() => null)
    if (loaded) listing = loaded
    else loadError = 'Could not load your API keys. Refresh the page to try again.'
  }

  return (
    <div className={SHELL}>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <a href="/account" className="underline-offset-4 hover:text-foreground hover:underline">
          Your account
        </a>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">API keys</span>
      </nav>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Developers</p>
      <h1 className="font-display mt-2 text-[1.9rem] font-medium leading-[1.15] tracking-tight text-foreground sm:text-4xl">
        API keys
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        One key connects BidDeed.AI&apos;s foreclosure and tax-deed tools to Claude, Cursor or your
        own agent through the hosted MCP server. Each account has one active key. Creating a new
        key replaces the old one.
      </p>
      <DeveloperKeysPanel initial={listing} initialError={loadError} />
    </div>
  )
}
