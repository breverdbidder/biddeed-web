'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect } from 'react'

/**
 * Hard-navigates away from the auth pages the moment the session activates.
 *
 * Measured on production 2026-09-18 (flight digest 54830976@E80, builds
 * _KgRF18P3IXZ4OpkAWa72 and UtCKLC3CiCBygBdnTdESL alike): in the seconds
 * after a factor completes, ClerkJS drives its post-auth redirect through a
 * soft Next navigation, and the resulting RSC flight request for the auth
 * route answers 500 while the Clerk session cookie is mid-handshake. The dead
 * flight kills the client transition, so a correctly-signed-in user is left
 * on a frozen form (or, on registration, a white screen) until a manual
 * reload. Steady-state requests — signed-in or anonymous — never crash.
 *
 * A full document navigation is the path the platform already recovers with:
 * middleware resolves the session handshake natively for document requests
 * (the 307 handshake chain works there exactly as it does on a manual
 * reload). Firing location.assign as soon as the session is active starts
 * that load immediately; a straggling flight error in the dying page cannot
 * cancel it. /radar is a public route, so this grants nothing.
 */
export default function SignedInRedirect({ to = '/radar' }: { to?: string }) {
  const { isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      window.location.assign(to)
    }
  }, [isLoaded, isSignedIn, to])

  return null
}
