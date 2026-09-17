'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'

/**
 * The verified-identity signal for Deed's client surfaces (PARITY CP-3).
 *
 * Clerk's hooks throw outside <ClerkProvider>, and ConditionalClerkProvider
 * mounts that provider only on authorised hosts with the key pair present.
 * So the composer, the thread hook and the sidebar never call useAuth()
 * themselves; they read this context, which a bridge component fills in
 * only when Clerk is actually mounted. Everywhere else it reads as signed
 * out — and signed out means nothing is stored, which is the #20226 rule.
 *
 * `loaded` is false until Clerk has answered once; the thread hook waits for
 * it so a signed-in reload does not first look like an anonymous one.
 */
export interface DeedAuthState {
  enabled: boolean
  loaded: boolean
  signedIn: boolean
  userId: string | null
}

const SIGNED_OUT: DeedAuthState = { enabled: false, loaded: true, signedIn: false, userId: null }

const DeedAuthContext = createContext<DeedAuthState>(SIGNED_OUT)

export function useDeedAuth(): DeedAuthState {
  return useContext(DeedAuthContext)
}

function ClerkBridge({ onChange }: { onChange: (s: DeedAuthState) => void }) {
  const { isLoaded, isSignedIn, userId } = useAuth()
  useEffect(() => {
    onChange({ enabled: true, loaded: Boolean(isLoaded), signedIn: Boolean(isSignedIn), userId: userId ?? null })
  }, [isLoaded, isSignedIn, userId, onChange])
  return null
}

export function DeedAuthProvider({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  const [state, setState] = useState<DeedAuthState>(authEnabled ? { enabled: true, loaded: false, signedIn: false, userId: null } : SIGNED_OUT)
  return (
    <DeedAuthContext.Provider value={state}>
      {authEnabled ? <ClerkBridge onChange={setState} /> : null}
      {children}
    </DeedAuthContext.Provider>
  )
}
