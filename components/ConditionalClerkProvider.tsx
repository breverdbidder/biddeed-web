'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { useTheme } from '@/lib/theme-context'
import { palette } from '@/lib/design-tokens'

// Ported from zonewise-web 2026-08-20 with one deliberate deviation: no
// `@clerk/themes` import. Clerk's appearance API needs real colour strings (it
// derives hover/focus shades from colorPrimary), so the values come from the JS
// mirror of the token file (lib/design-tokens.ts); the `elements` overrides use
// the same Tailwind token classes as the rest of the app.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

function clerkAppearance(theme: 'light' | 'dark') {
  const c = palette(theme)
  return {
    variables: {
      colorBackground: c.card,
      colorText: c.ink,
      colorTextSecondary: c.navy,
      colorInputBackground: c.background,
      colorInputText: c.ink,
      colorPrimary: c.brand,
      colorDanger: c.brand,
      colorSuccess: c.brandHover,
      colorWarning: c.brand,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    elements: {
      formButtonPrimary: 'bg-primary hover:bg-primary-hover text-primary-foreground font-semibold',
      card: 'shadow-lg border border-border bg-card',
      headerTitle: 'text-foreground',
      headerSubtitle: 'text-muted-foreground',
      socialButtonsBlockButton: 'border-border text-foreground hover:bg-secondary',
      formFieldLabel: 'text-foreground',
      formFieldInput: 'bg-background border-border text-foreground placeholder:text-muted-foreground',
      formFieldErrorText: 'text-primary',
      formFieldSuccessText: 'text-primary',
      footerActionText: 'text-muted-foreground',
      footerActionLink: 'text-primary hover:text-primary-hover',
      identityPreviewText: 'text-foreground',
      identityPreviewEditButton: 'text-primary hover:text-primary-hover',
      alert: 'border-border bg-secondary text-foreground',
      alertText: 'text-foreground',
      userButtonAvatarBox: 'w-7 h-7',
    },
  }
}

// The shared dev instance is named "My Application" in Clerk's dashboard, so
// the stock <SignIn> card renders "Sign in to My Application". Renaming the
// instance would mis-title the OTHER property (zonewise shares this pool), so
// each site overrides the strings locally instead.
const clerkLocalization = {
  signIn: {
    start: {
      title: 'Sign in to BidDeed.AI',
      subtitle: 'Welcome back! Please sign in to continue',
    },
  },
  signUp: {
    start: {
      title: 'Create your BidDeed.AI account',
      subtitle: 'One account works across BidDeed.AI and ZoneWise.AI',
    },
  },
}

export default function ConditionalClerkProvider({
  children,
  nonce,
  hostAuthorized = false,
  authEnabled = false,
}: {
  children: React.ReactNode
  /**
   * Whether the serving host is one the production Clerk instance recognises
   * (biddeed.ai, *.biddeed.ai, localhost). Computed server-side in layout.tsx
   * from x-forwarded-host so server and client render identically. On any
   * other host Clerk's same-origin /__clerk proxy calls are answered 400
   * host_invalid by Clerk - so the provider stands down instead of shipping
   * two guaranteed-failed requests per page view.
   */
  hostAuthorized?: boolean
  /**
   * Explicit staged activation flag. Keys may be present while the provider
   * remains disabled until proxy and authenticated E2E checks pass.
   */
  authEnabled?: boolean
  /**
   * CSP nonce from middleware (x-nonce). REQUIRED: script-src uses
   * 'strict-dynamic', which makes host allowlists inert — Clerk's injected
   * scripts are only trusted if they carry the nonce. Without this the sign-in
   * form renders but every Clerk request is blocked and Continue does nothing.
   * (Scar carried over from zonewise-web, where this exact failure shipped.)
   */
  nonce?: string
}) {
  const { theme } = useTheme()

  // No key -> render children without ClerkProvider. Keeps the app fully
  // functional in passthrough mode and mirrors middleware.ts, where
  // CLERK_ENABLED requires both halves of the credential pair.
  if (!CLERK_KEY || !hostAuthorized || !authEnabled) {
    return <>{children}</>
  }

  return (
    <ClerkProvider appearance={clerkAppearance(theme)} localization={clerkLocalization} nonce={nonce}>
      {children}
    </ClerkProvider>
  )
}
