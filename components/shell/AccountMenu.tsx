'use client'

import dynamic from 'next/dynamic'
import { ChevronsUpDown, UserRound } from 'lucide-react'

import Link from '@/components/ui/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { ACCOUNT_LINKS } from './nav'

const AuthAccountMenuItems = dynamic(() => import('./SidebarClerk').then((m) => m.AuthAccountMenuItems), { ssr: false })

/**
 * The sidebar's Account dropdown. Loaded on first use (see LazyAccountMenu in
 * AppSidebar): Radix's menu, popper and focus-scope code is ~30 KiB
 * compressed that every page used to download and initialise for a menu that
 * is closed on every page load (PageSpeed pass 3, 2026-10-07).
 */
export default function AccountMenu({
  authEnabled,
  onNavigate,
  defaultOpen = false,
}: {
  authEnabled: boolean
  onNavigate: () => void
  defaultOpen?: boolean
}) {
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Account">
          <UserRound />
          <span>Account</span>
          <ChevronsUpDown className="ml-auto size-4 opacity-60" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {authEnabled ? (
          <AuthAccountMenuItems onNavigate={onNavigate} />
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/sign-in" onClick={onNavigate}>Sign in</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/sign-up" onClick={onNavigate}>Create account</Link>
            </DropdownMenuItem>
          </>
        )}
        {ACCOUNT_LINKS.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            {/* Worker routes — plain anchors, deliberately. */}
            <a href={link.href}>{link.label}</a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
