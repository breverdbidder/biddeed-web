'use client'

import { useAuth } from '@clerk/nextjs'
import FreeReportPopup from '@/components/lead/FreeReportPopup'

/**
 * Clerk-aware mount for the free-report popup. Rendered only inside
 * ClerkProvider (ConditionalClerkProvider's auth branch), because useAuth
 * throws without a provider. Until Clerk has loaded, signedIn is undefined and
 * the popup stays closed, so a member is never flashed a lead form.
 */
export default function FreeReportPopupAuthGate() {
  const { isLoaded, isSignedIn } = useAuth()
  return <FreeReportPopup signedIn={isLoaded ? Boolean(isSignedIn) : undefined} />
}
