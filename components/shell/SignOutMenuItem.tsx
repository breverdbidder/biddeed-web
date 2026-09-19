'use client'

import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

/**
 * Explicit, hard-redirecting sign out.
 *
 * The only sign-out control used to be Clerk's bare <UserButton> popover, whose
 * default post-sign-out navigation is a Next App-Router soft push. On the
 * OpenNext / Cloudflare Workers deployment that soft transition did not
 * complete: the session was cleared server-side but the SPA never re-rendered,
 * so the sidebar still read "Signed in" and the tap appeared to do nothing — a
 * freeze, reported live on mobile 2026-09-19. It was also the ONLY way to sign
 * out (the Account dropdown, where a user naturally looks, had no sign-out item
 * at all when signed in).
 *
 * Forcing window.location.assign('/') after signOut() guarantees a full
 * document reload, which re-runs middleware and the server layout in the
 * signed-out state regardless of what Clerk's client navigation does. The
 * finally block ensures the redirect fires even if signOut() rejects.
 *
 * MUST be rendered only inside ClerkProvider — i.e. under an authEnabled +
 * <Show when="signed-in"> guard. useClerk() throws without a provider, so this
 * lives in its own component mounted only on that path rather than as a hook in
 * AppSidebar, which also renders in the no-auth passthrough mode.
 */
export function SignOutMenuItem({ onSelect }: { onSelect?: () => void }) {
  const { signOut } = useClerk()
  return (
    <DropdownMenuItem
      onClick={async () => {
        onSelect?.()
        try {
          await signOut()
        } finally {
          window.location.assign('/')
        }
      }}
    >
      <LogOut className="mr-2 size-4" />
      Sign out
    </DropdownMenuItem>
  )
}
