'use client'

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { clearThreads } from '@/lib/deed/threads'
import { chatHistoryContainmentEnabled } from '@/lib/deed/chatHistoryContainment'

/**
 * Re-wipes locally-stored chat thread history on every sign-in, sign-out, or
 * account switch while containment (#80) is active. Only ever mounted inside
 * an active <ClerkProvider> (see ConditionalClerkProvider) — useUser() throws
 * outside one.
 *
 * ChatHistoryContainmentGate already wipes storage on first render, so the
 * first user id Clerk resolves to is just recorded, not treated as a
 * transition; every id change after that (including to/from signed-out,
 * i.e. `null`) is a real sign-in/out/switch and triggers another wipe.
 */
export default function ChatHistoryContainmentAuthWatcher() {
  const { user, isLoaded } = useUser()
  const seen = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!isLoaded || !chatHistoryContainmentEnabled()) return
    const id = user?.id ?? null
    if (seen.current !== undefined && seen.current !== id) clearThreads()
    seen.current = id
  }, [isLoaded, user?.id])

  return null
}
