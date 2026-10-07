'use client'

import Link from '@/components/ui/link'
import { Show } from '@clerk/nextjs'

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { SignOutMenuItem } from './SignOutMenuItem'

/**
 * Account menu items that depend on the Clerk session. Its own module, loaded
 * by AccountMenu only when auth is on (PageSpeed pass 3, 2026-10-07): the
 * signed-out landing page renders the sidebar without Clerk and must not
 * download the SDK through it.
 */
export function AuthAccountMenuItems({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      <Show when="signed-out">
        <DropdownMenuItem asChild>
          <Link href="/sign-in" onClick={onNavigate}>Sign in</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/sign-up" onClick={onNavigate}>Create account</Link>
        </DropdownMenuItem>
      </Show>
      <Show when="signed-in">
        <DropdownMenuItem asChild>
          <Link href="/dashboard" onClick={onNavigate}>Account dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SignOutMenuItem onSelect={onNavigate} />
      </Show>
    </>
  )
}
