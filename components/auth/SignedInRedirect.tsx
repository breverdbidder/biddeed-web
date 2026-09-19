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
 * Layer 2 (this change): on production the post-auth transition's RSC flight
 * request 500s in the handshake window (digest 54830976@E80, reproduced on
 * the #166, #167 AND #168 builds) and the dead flight kills the React tree
 * before the session activates client-side — so Layer 1 never gets to run.
 * The fatal error surfaces as a window `unhandledrejection` event carrying
 * the minified-React error 441 message (measured live 2026-09-18), and window-level
 * listeners registered here keep working after the tree dies. On detection,
 * poll the public /api/viewer/tier endpoint: the session DOES establish
 * server-side within seconds-to-a-minute of the crash, and the first
 * signed_in:true answer triggers the same hard navigation to /radar. If the
 * session never lands (genuinely failed sign-in), reload instead — an
 * anonymous reload simply re-renders the healthy form.
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
    let timers: ReturnType<typeof setTimeout>[] = []
    let done = false

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
          window.location.reload()
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
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      timers.forEach(clearTimeout)
    }
  }, [to])

  return null
}
