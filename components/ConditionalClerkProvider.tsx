'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { useTheme } from '@/lib/theme-context'

// Ported from zonewise-web 2026-08-20 with one deliberate deviation: no
// `@clerk/themes` import. That package is not in this repo's dependencies and
// adding it for `baseTheme: dark` alone is not worth a new dependency — the
// variables + elements below reproduce the dark treatment directly against
// this app's fixed #020617 chrome.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// Light-theme values are the #20060 canon seven (memo default, see
// docs/design/PARITY_PRD.md s8): accent #005eb8, ink #1a1a1a, secondary navy
// #0a2540/#004a92, border/tint #d7e3f1/#e6f0fa, muted text #657786. Dark-theme
// values are untouched — they already match the house brand (navy chrome,
// #F59E0B accent, #020617 ground) and were never flagged as off-palette.
function clerkAppearance(theme: 'light' | 'dark') {
  const light = theme === 'light'
  return {
    variables: {
      colorBackground: light ? '#ffffff' : '#0b1220',
      colorText: light ? '#1a1a1a' : '#e2e8f0',
      colorTextSecondary: light ? '#0a2540' : '#94a3b8',
      colorInputBackground: light ? '#ffffff' : '#1e293b',
      colorInputText: light ? '#1a1a1a' : '#e2e8f0',
      colorPrimary: light ? '#005eb8' : '#F59E0B',
      colorDanger: '#dc2626',
      colorSuccess: '#16a34a',
      colorWarning: light ? '#005eb8' : '#F59E0B',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    elements: {
      formButtonPrimary: light ? 'bg-[#005EB8] hover:bg-[#004A92] text-white font-semibold' : 'bg-[#F59E0B] hover:bg-[#fbbf24] text-[#020617] font-semibold',
      card: light ? 'shadow-lg border border-[#D7E3F1] bg-white' : 'shadow-lg border border-slate-700 bg-[#0b1220]',
      headerTitle: light ? 'text-[#1A1A1A]' : 'text-white',
      headerSubtitle: light ? 'text-[#657786]' : 'text-slate-400',
      socialButtonsBlockButton: light ? 'border-[#D7E3F1] text-[#1A1A1A] hover:bg-[#E6F0FA]' : 'border-slate-600 text-slate-300 hover:bg-slate-800',
      formFieldInput: light ? 'bg-white border-[#D7E3F1] text-[#1A1A1A]' : 'bg-slate-800 border-slate-600 text-white',
      footerActionLink: light ? 'text-[#005EB8] hover:text-[#004A92]' : 'text-[#F59E0B] hover:text-[#fbbf24]',
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
