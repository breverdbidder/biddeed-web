'use client'

import { Show, UserButton } from '@clerk/nextjs'

import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar'

/**
 * "Signed in" row with Clerk's avatar menu, above the Account menu. Its own
 * module so AppSidebar loads it only when auth is on (PageSpeed pass 3,
 * 2026-10-07): the signed-out landing page renders the sidebar without Clerk
 * and must not download the SDK through it.
 */
export default function SidebarSignedInRow() {
  return (
    <Show when="signed-in">
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <UserButton appearance={{ elements: { avatarBox: 'size-8' } }} />
            <span className="truncate text-xs text-sidebar-foreground">Signed in</span>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </Show>
  )
}
