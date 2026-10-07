'use client'

import dynamic from 'next/dynamic'
import { ClerkProvider } from '@clerk/nextjs'
import { useTheme } from '@/lib/theme-context'
import { palette } from '@/lib/design-tokens'
import PostHogIdentify from '@/components/analytics/PostHogIdentify'
import { useEngagedMount } from '@/lib/perf/idle'
import { AUTH_CARD_COPY } from '@/lib/auth/clerk-copy'

/**
 * The Clerk half of ConditionalClerkProvider, in its own module so the Clerk
 * SDK is downloaded only where auth is actually on. The signed-out landing
 * page renders without it (PageSpeed pass 3, 2026-10-07: middleware marks a
 * GET / with no Clerk session cookie as the lean home, and layout.tsx turns
 * auth off for that one render) and so never loads clerk-js, @clerk/ui or
 * this chunk.
 *
 * Ported from zonewise-web 2026-08-20 with one deliberate deviation: no
 * `@clerk/themes` import. Clerk's appearance API needs real colour strings (it
 * derives hover/focus shades from colorPrimary), so the values come from the JS
 * mirror of the token file (lib/design-tokens.ts); the `elements` overrides use
 * the same Tailwind token classes as the rest of the app.
 */
const FreeReportPopupAuthGate = dynamic(() => import('@/components/lead/FreeReportPopupAuthGate'), { ssr: false })

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
      // min-h-11: Clerk's own inputs/buttons/links render at their stock ~32px
      // (buttons) / ~32px (inputs) / ~18px (footer link) heights — under the 44px tap-target
      // floor the rest of the app ships. inline-flex+items-center on the
      // footer link for the same reason the prose links elsewhere in this
      // app needed it: a bare line-height bump does not inflate an inline
      // element's own bounding box.
      formButtonPrimary: 'min-h-11 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold',
      card: 'shadow-lg border border-border bg-card',
      headerTitle: 'text-foreground',
      headerSubtitle: 'text-base text-muted-foreground',
      socialButtonsBlockButton: 'min-h-11 border-border text-foreground hover:bg-secondary',
      formFieldLabel: 'text-foreground',
      formFieldInput:
        'min-h-11 bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary',
      // P1-9: the password-reveal toggle renders ~26px tall; give the icon
      // button a 44px box without visually enlarging the glyph.
      formFieldInputShowPasswordButton: 'min-h-11 min-w-[44px] text-muted-foreground hover:text-foreground',
      formFieldErrorText: 'text-primary',
      formFieldSuccessText: 'text-primary',
      footerActionText: 'text-muted-foreground',
      footerActionLink: 'inline-flex min-h-11 items-center text-primary hover:text-primary-hover',
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
  signIn: { start: { ...AUTH_CARD_COPY.signIn } },
  signUp: { start: { ...AUTH_CARD_COPY.signUp } },
}

export default function ClerkAuthShell({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const { theme } = useTheme()
  const popupReady = useEngagedMount()
  return (
    <ClerkProvider appearance={clerkAppearance(theme)} localization={clerkLocalization} nonce={nonce}>
      {/* Inside the provider so useAuth/useUser resolve; ties the Clerk user to
          their PostHog identity. Renders null. */}
      <PostHogIdentify />
      {children}
      {/* Free-report lead popup for signed-out visitors only (issue #181). */}
      {popupReady ? <FreeReportPopupAuthGate /> : null}
    </ClerkProvider>
  )
}
