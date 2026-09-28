'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect } from 'react'
import { LIGHT as C } from '@/lib/design-tokens'
import { HANDOFF_POLL_MS, handoffStep, showHandoffOverlay } from '@/lib/auth/handoff'

const RADAR = '/radar'
const COLORS = { background: C.background, ink: C.ink, muted: C.navy, brand: C.brand }

type ClerkGlobal = { session?: { id?: string } | null }

/** Shows "Signing you in…" and loads the destination as a new document. */
function leaveFor(to: string) {
  showHandoffOverlay(document, COLORS)
  window.location.assign(to)
}

/**
 * Escorts a just-authenticated visitor off the auth pages.
 *
 * Layer 1 (added in #168): the instant useAuth() reports an active session,
 * show the "Signing you in…" screen and hard-navigate to /radar. A document
 * navigation resolves the Clerk session handshake natively — the same path
 * that always recovered a manual reload.
 *
 * Layer 2: if the React tree dies before the session activates client-side,
 * Layer 1 never runs. That happened on every sign-up until 28 Sep 2026: the
 * Server Action Clerk awaits before activating a session answered 500 on
 * biddeed.ai (fixed in config/server-action-origins.mjs), React threw #441,
 * the page went blank, and this fallback polled every 3 s, so new members
 * waited 18-48 s on a blank page. The fatal error surfaces as a window
 * `unhandledrejection` carrying the minified-React error 441 message, and
 * window-level listeners registered here keep working after the tree dies.
 * On detection: show the overlay at once (plain DOM, so it renders without
 * React), then every second check the browser's Clerk client and the public
 * /api/viewer/tier endpoint, and go to /radar on the first sign of a session.
 * If none lands in 90 s (a genuinely failed sign-in), reload instead — an
 * anonymous reload simply re-renders the healthy form.
 *
 * /radar is a public route and /api/viewer/tier is a public endpoint; this
 * grants nothing and touches no security control.
 */
export default function SignedInRedirect({ to = RADAR }: { to?: string }) {
  const { isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (isLoaded && isSignedIn) leaveFor(to)
  }, [isLoaded, isSignedIn, to])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let done = false

    const recover = () => {
      if (done) return
      done = true
      showHandoffOverlay(document, COLORS)
      const started = Date.now()
      const tick = async () => {
        const clerk = (window as unknown as { Clerk?: ClerkGlobal }).Clerk
        const clientSession = Boolean(clerk?.session?.id)
        let serverSignedIn = false
        if (!clientSession) {
          try {
            const r = await fetch('/api/viewer/tier', { credentials: 'include', cache: 'no-store' })
            const t = await r.json()
            serverSignedIn = Boolean(t && t.signed_in)
          } catch {
            // endpoint unreachable — ask again on the next tick
          }
        }
        const step = handoffStep({ elapsedMs: Date.now() - started, clientSession, serverSignedIn })
        if (step === 'go') window.location.assign(to)
        else if (step === 'reload') window.location.reload()
        else timers.push(setTimeout(tick, HANDOFF_POLL_MS))
      }
      void tick()
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason && e.reason.message) || e.reason || '')
      if (msg.includes('errors/441')) recover()
    }

    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      timers.forEach(clearTimeout)
    }
  }, [to])

  return null
}
