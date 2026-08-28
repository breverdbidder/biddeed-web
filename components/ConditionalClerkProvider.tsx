'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { useTheme } from '@/lib/theme-context'

// Ported from zonewise-web 2026-08-20 with one deliberate deviation: no
// `@clerk/themes` import. That package is not in this repo's dependencies and
// adding it for `baseTheme: dark` alone is not worth a new dependency — the
// variables + elements below reproduce the dark treatment directly against
// this app's fixed #020617 chrome.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

function clerkAppearance(theme: 'light' | 'dark') {
  const light = theme === 'light'
  return {
    variables: {
      colorBackground: light ? '#fbfaf7' : '#0b1220',
      colorText: light ? '#1f1b16' : '#e2e8f0',
      colorTextSecondary: light ? '#766f67' : '#94a3b8',
      colorInputBackground: light ? '#f5f0e8' : '#1e293b',
      colorInputText: light ? '#1f1b16' : '#e2e8f0',
      colorPrimary: light ? '#c15f3c' : '#F59E0B',
      colorDanger: '#dc2626',
      colorSuccess: '#16a34a',
      colorWarning: light ? '#c15f3c' : '#F59E0B',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    elements: {
      formButtonPrimary: light ? 'bg-[#C15F3C] hover:bg-[#A94D30] text-[#F5F0E8] font-semibold' : 'bg-[#F59E0B] hover:bg-[#fbbf24] text-[#020617] font-semibold',
      card: light ? 'shadow-lg border border-[#DDD5C9] bg-[#FBFAF7]' : 'shadow-lg border border-slate-700 bg-[#0b1220]',
      headerTitle: light ? 'text-[#1F1B16]' : 'text-white',
      headerSubtitle: light ? 'text-[#766F67]' : 'text-slate-400',
      socialButtonsBlockButton: light ? 'border-[#B5A9A0] text-[#1F1B16] hover:bg-[#EDE3D7]' : 'border-slate-600 text-slate-300 hover:bg-slate-800',
      formFieldInput: light ? 'bg-[#F5F0E8] border-[#B5A9A0] text-[#1F1B16]' : 'bg-slate-800 border-slate-600 text-white',
      footerActionLink: light ? 'text-[#C15F3C] hover:text-[#A94D30]' : 'text-[#F59E0B] hover:text-[#fbbf24]',
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
  const { theme } = useTheme()

  // No key -> render children without ClerkProvider. Keeps the app fully
  // functional in passthrough mode and mirrors middleware.ts, where
  // CLERK_ENABLED requires both halves of the credential pair.
  if (!CLERK_KEY || !hostAuthorized) {
    return <>{children}</>
  }

  return (
    <ClerkProvider appearance={clerkAppearance(theme)} localization={clerkLocalization} nonce={nonce}>
      {children}
    </ClerkProvider>
  )
}
