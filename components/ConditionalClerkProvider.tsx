'use client'

import { ClerkProvider } from '@clerk/nextjs'

// Ported from zonewise-web 2026-08-20 with one deliberate deviation: no
// `@clerk/themes` import. That package is not in this repo's dependencies and
// adding it for `baseTheme: dark` alone is not worth a new dependency — the
// variables + elements below reproduce the dark treatment directly against
// this app's fixed #020617 chrome.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const clerkAppearance = {
  variables: {
    colorBackground: '#0b1220',
    colorText: '#e2e8f0',
    colorTextSecondary: '#94a3b8',
    colorInputBackground: '#1e293b',
    colorInputText: '#e2e8f0',
    colorPrimary: '#F59E0B',
    colorDanger: '#dc2626',
    colorSuccess: '#16a34a',
    colorWarning: '#F59E0B',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  elements: {
    formButtonPrimary: 'bg-[#F59E0B] hover:bg-[#fbbf24] text-[#020617] font-semibold',
    card: 'shadow-lg border border-slate-700 bg-[#0b1220]',
    headerTitle: 'text-white',
    headerSubtitle: 'text-slate-400',
    socialButtonsBlockButton: 'border-slate-600 text-slate-300 hover:bg-slate-800',
    formFieldInput: 'bg-slate-800 border-slate-600 text-white',
    footerActionLink: 'text-[#F59E0B] hover:text-[#fbbf24]',
    userButtonAvatarBox: 'w-7 h-7',
  },
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
   * CSP nonce from middleware (x-nonce). REQUIRED: script-src uses
   * 'strict-dynamic', which makes host allowlists inert — Clerk's injected
   * scripts are only trusted if they carry the nonce. Without this the sign-in
   * form renders but every Clerk request is blocked and Continue does nothing.
   * (Scar carried over from zonewise-web, where this exact failure shipped.)
   */
  nonce?: string
}) {
  // No key -> render children without ClerkProvider. Keeps the app fully
  // functional in passthrough mode and mirrors middleware.ts, where
  // CLERK_ENABLED requires both halves of the credential pair.
  if (!CLERK_KEY || !hostAuthorized) {
    return <>{children}</>
  }

  return (
    <ClerkProvider appearance={clerkAppearance} localization={clerkLocalization} nonce={nonce}>
      {children}
    </ClerkProvider>
  )
}
