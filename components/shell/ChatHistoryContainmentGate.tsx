'use client'

import { useEffect } from 'react'
import { clearThreads } from '@/lib/deed/threads'
import { chatHistoryContainmentEnabled } from '@/lib/deed/chatHistoryContainment'

/**
 * Wipes locally-stored chat thread history on every app load while
 * containment (#80) is active — closes the window between a previous
 * visit's leftover localStorage and this session's first render. Mounted
 * unconditionally in app/layout.tsx, independent of whether Clerk is
 * configured (see ChatHistoryContainmentAuthWatcher for the Clerk-only,
 * per-sign-in/out/switch half of this).
 */
export default function ChatHistoryContainmentGate() {
  useEffect(() => {
    if (chatHistoryContainmentEnabled()) clearThreads()
  }, [])
  return null
}
