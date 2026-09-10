'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'

import { CHAT_HISTORY_CONTAINED, clearThreads } from '@/lib/deed/threads'
import { clearChatIdentity } from '@/lib/deed/chatIdentity'

function clearLegacyChatData() {
  clearThreads()
  clearChatIdentity()
}

/**
 * Privacy containment (issue #20226).
 *
 * A returning visitor's browser may still hold saved threads or a legacy
 * chat token from before containment shipped. Neither one is read
 * anywhere while CHAT_HISTORY_CONTAINED is on (see lib/deed/threads.ts and
 * lib/deed/chatIdentity.ts) — this component's job is to actively erase them
 * so a second person using the same browser/profile can't find them either,
 * not just stop the app from showing them.
 *
 * Split into two effects because the Clerk-auth watcher can only run where
 * Clerk is actually mounted (see ClerkContainmentWatcher below) — a bare
 * useAuth() call throws outside <ClerkProvider>, which ConditionalClerkProvider
 * skips entirely on unauthorized hosts or while auth is staged off.
 */
export default function ChatContainmentGuard({ authEnabled = false }: { authEnabled?: boolean }) {
  useEffect(() => {
    if (CHAT_HISTORY_CONTAINED) clearLegacyChatData()
  }, [])

  return authEnabled ? <ClerkContainmentWatcher /> : null
}

function ClerkContainmentWatcher() {
  const { isSignedIn } = useAuth()
  const prev = useRef(isSignedIn)

  useEffect(() => {
    if (CHAT_HISTORY_CONTAINED && prev.current !== isSignedIn) clearLegacyChatData()
    prev.current = isSignedIn
  }, [isSignedIn])

  return null
}
