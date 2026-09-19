'use client'

import { useEffect, useRef } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'

/**
 * Ties the signed-in Clerk user to their PostHog identity, so authed events
 * attribute to a person rather than an anonymous device. This is the
 * prerequisite for a registration -> checkout funnel (PARITY D14) that can name
 * who converted, and for tying a support/session back to an account.
 *
 * MUST be mounted only inside ClerkProvider — it is rendered by
 * ConditionalClerkProvider only on the auth-enabled branch. useAuth/useUser
 * throw without a provider, which is why this is a standalone component on that
 * path and not a hook in the layout (which also renders in passthrough mode).
 *
 * PostHog is loaded asynchronously by PostHogAnalytics (array.js), so identify
 * is retried until window.posthog exists, then stops. Identity is only reset on
 * a live signed-in -> signed-out transition (e.g. session expiry): an anonymous
 * first visit never calls reset, so its distinct_id is preserved. The explicit
 * Sign out button resets PostHog itself, before its hard redirect.
 */

type PostHogLike = {
  identify?: (id: string, props?: Record<string, unknown>) => void
  reset?: () => void
}
function ph(): PostHogLike | undefined {
  return (globalThis as unknown as { posthog?: PostHogLike }).posthog
}

export default function PostHogIdentify() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { user } = useUser()
  const identified = useRef(false)

  useEffect(() => {
    if (!isLoaded) return
    let cancelled = false
    let tries = 0

    const run = () => {
      if (cancelled) return
      const posthog = ph()
      if (!posthog?.identify) {
        // SDK not ready yet — array.js loads async. Retry for ~20s then give up.
        if (tries++ < 40) setTimeout(run, 500)
        return
      }
      if (isSignedIn && userId) {
        const email = user?.primaryEmailAddress?.emailAddress
        posthog.identify(userId, email ? { email } : undefined)
        identified.current = true
      } else if (identified.current) {
        posthog.reset?.()
        identified.current = false
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, userId, user])

  return null
}
