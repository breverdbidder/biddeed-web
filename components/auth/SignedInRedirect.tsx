'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect } from 'react'

const RADAR = '/radar'

/**
 * Escorts a just-authenticated visitor off the auth pages.
 *
 * Layer 1 (added in #168): the instant useAuth() reports an active session,
 * hard-navigate to /radar. A document navigation resolves the Clerk session
 * handshake natively — the same path that always recovered a manual reload.
 *
 * Layer 2 (added in #169/#170): on production the post-auth transition's RSC
 * flight request 500s in the handshake window (digest 54830976@E80, reproduced
 * on the #166, #167 AND #168 builds) and the dead flight kills the React tree
 * before the session activates client-side — so Layer 1 never gets to run.
 * The fatal error surfaces as a window `unhandledrejection` event carrying the
 * minified-React error-441 URL (measured live 2026-09-18), and window-level
 * listeners registered here keep working after the tree dies. On detection,
 * poll the public /api/viewer/tier endpoint: the session DOES establish
 * server-side within seconds-to-a-minute of the crash, and the first
 * signed_in:true answer triggers the same hard navigation to /radar. If the
 * session never lands (genuinely failed sign-in), reload instead — an
 * anonymous reload simply re-renders the healthy form.
 *
 * Layer 3 (this change): the OAuth callback routes (/sign-in/sso-callback,
 * /sign-up/sso-callback) get the recovery poll WITHOUT waiting for the
 * error-441 signal. Measured on production 2026-09-18 (mobile Chrome, GitHub
 * OAuth): the callback page sits on the Clerk spinner indefinitely — the
 * transition stalls without emitting the rejection signature Layer 2 listens
 * for, and the Layer-2 fallback RELOADS a spent ticket URL, looping the same
 * spinner forever. Nobody legitimately lingers on sso-callback: a healthy
 * callback completes in seconds, so polling immediately is a no-op in the
 * success case (Layer 1 or ClerkJS's own redirect wins the race and unloads
 * the page). On timeout the callback routes bounce to the fresh auth form
 * instead of reloading — a reload of a spent callback URL can never succeed.
 *
 * /radar is a public route and /api/viewer/tier is a public endpoint; this
 * grants nothing and touches no security control.
 */
export default function SignedInRedirect({ to = RADAR }: { to?: string }) {
  const { isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      window.location.assign(to)
    }
  }, [isLoaded, isSignedIn, to])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let done = false

    const pathname = window.location.pathname
    const onCallback = pathname.includes('sso-callback')
    const formPath = pathname.startsWith('/sign-up') ? '/sign-up' : '/sign-in'

    const recover = () => {
      if (done) return
      done = true
      const started = Date.now()
      const poll = async () => {
        try {
          const r = await fetch('/api/viewer/tier', { credentials: 'include' })
          const t = await r.json()
          if (t && t.signed_in) {
            window.location.assign(to)
            return
          }
        } catch {
          // endpoint unreachable — fall through to the next attempt
        }
        if (Date.now() - started > 90_000) {
          // A callback URL cannot be reloaded into success — its ticket is
          // spent — so bounce to the fresh form; elsewhere a reload simply
          // re-renders the healthy anonymous page.
          if (onCallback) {
            window.location.assign(formPath)
          } else {
            window.location.reload()
          }
          return
        }
        timers.push(setTimeout(poll, 3_000))
      }
      timers.push(setTimeout(poll, 3_000))
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason && e.reason.message) || e.reason || '')
      if (msg.includes('errors/441')) recover()
    }

    window.addEventListener('unhandledrejection', onRejection)
    // The OAuth callback can stall WITHOUT the error-441 signature (mobile
    // GitHub sign-in, measured 2026-09-18): start recovery immediately there.
    // A healthy callback completes in seconds and unloads this page first.
    if (onCallback) recover()
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      timers.forEach(clearTimeout)
    }
  }, [to])

  return null
}
