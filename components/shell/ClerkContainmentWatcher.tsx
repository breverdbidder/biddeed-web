'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'

import { CHAT_HISTORY_CONTAINED } from '@/lib/deed/threads'
import { clearLegacyChatData } from './ChatContainmentGuard'

/**
 * Erases contained chat data whenever the Clerk session flips (see
 * ChatContainmentGuard). Its own module, loaded only where Clerk is mounted,
 * so pages without Clerk never download the SDK through the shell.
 */
export default function ClerkContainmentWatcher() {
  const { isSignedIn } = useAuth()
  const prev = useRef(isSignedIn)

  useEffect(() => {
    if (CHAT_HISTORY_CONTAINED && prev.current !== isSignedIn) clearLegacyChatData()
    prev.current = isSignedIn
  }, [isSignedIn])

  return null
}
