'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'

import type { DeedAuthState } from './deedAuth'

/**
 * Fills DeedAuthContext from Clerk. Its own module so the Clerk SDK is only
 * downloaded where ClerkProvider is actually mounted (DeedAuthProvider loads
 * it on demand) - the signed-out landing page renders without Clerk at all
 * (PageSpeed pass 3, 2026-10-07).
 */
export default function ClerkBridge({ onChange }: { onChange: (s: DeedAuthState) => void }) {
  const { isLoaded, isSignedIn, userId } = useAuth()
  useEffect(() => {
    onChange({ enabled: true, loaded: Boolean(isLoaded), signedIn: Boolean(isSignedIn), userId: userId ?? null })
  }, [isLoaded, isSignedIn, userId, onChange])
  return null
}
