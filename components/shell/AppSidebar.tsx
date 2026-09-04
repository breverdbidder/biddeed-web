'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Show, UserButton } from '@clerk/nextjs'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronsUpDown, FolderKanban, MessageSquarePlus, MessagesSquare, Sparkles, Trash2, UserRound } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ACCOUNT_LINKS, NAV_ITEMS, type NavItem } from './nav'
import { formatCount, useAuctionCounts } from './useAuctionCounts'
import DeedRobotMark from '@/components/deed/DeedRobotMark'
import { deleteThread, loadThreads, subscribeThreads, type Thread } from '@/lib/deed/threads'

interface Props {
  deedOpen: boolean
  onToggleDeed: () => void
  authEnabled?: boolean
  /** false on '/', where the page itself is the conversation. */
  showDeedToggle?: boolean
}

/**
 * Decide the active item from the URL alone.
 *
 * Auctions and Calendar are the same route (/radar) in two view states, so the
 * `view` query param is part of the identity of the active item. Anything that
 * looked only at pathname would light both of them at once.
 */
function isActiveItem(item: NavItem, pathname: string, view: string | null): boolean {
  if (item.external) return false
  switch (item.key) {
    case 'auctions':
      return pathname.startsWith('/radar') && view !== 'calendar'
    case 'calendar':
      return pathname.startsWith('/radar') && view === 'calendar'
    default:
      return pathname === item.href
  }
}

/**
 * Recent conversations, read from the browser. Empty until the first message
 * is sent on this device; that is the intended first-run state, so the group
 * simply does not render rather than showing an empty list.
 */
function useRecentThreads(): Thread[] {
  const [threads, setThreads] = useState<Thread[]>([])
  useEffect(() => {
    const refresh = () => setThreads(loadThreads().slice(0, 8))
    refresh()
    return subscribeThreads(refresh)
  }, [])
  return threads
}

export default function AppSidebar({ deedOpen, onToggleDeed, authEnabled = false, showDeedToggle = true }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')
  const activeThread = pathname === '/' ? searchParams.get('c') : null
  const counts = useAuctionCounts()
  const { isMobile, setOpenMobile } = useSidebar()
  const recent = useRecentThreads()

  // On mobile the nav lives in a Sheet; tapping a link has to close it, or the
  // user lands on the new page with the overlay still covering it.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const newChatActive = pathname === '/' && !activeThread

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="BidDeed.AI">
              <Link href="/" onClick={closeOnMobile}>
                <span
                  aria-hidden
                  className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground"
                >
                  B
                </span>
                <span className="grid text-left leading-tight">
                  <span className="truncate text-sm font-bold text-sidebar-foreground">
                    Bid<span className="text-primary">Deed</span>.AI
                  </span>
                  <span className="truncate text-xs text-muted-foreground">Auction Intelligence</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={newChatActive}
                  tooltip="New chat — ask Deed"
                  className="font-medium"
                >
                  <Link href="/" aria-current={newChatActive ? 'page' : undefined} onClick={closeOnMobile}>
                    <MessageSquarePlus />
                    <span>New chat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/*
          Projects and Skills — Claude.ai sidebar parity (issue #19934). Both
          are real surfaces on the Worker's own /chat page today (Projects:
          issue #19847 C3) or not yet built at all (Skills: P3, "Not started"
          per docs/spec/19829.md's phase table) — there is no dedicated Next
          page for either yet, so both are honest external links into /chat
          rather than a Next route that would 404, per the issue's own
          "until the Next pages exist" scope note.
        */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Projects — group chats, files, and reports around one property">
                  <a href="/chat" onClick={closeOnMobile}>
                    <FolderKanban />
                    <span>Projects</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Skills — coming soon; opens Deed chat for now">
                  <a href="/chat" onClick={closeOnMobile}>
                    <Sparkles />
                    <span>Skills</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {recent.length > 0 ? (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recent.map((t) => {
                  const active = activeThread === t.id
                  return (
                    <SidebarMenuItem key={t.id}>
                      <SidebarMenuButton asChild isActive={active} tooltip={t.title}>
                        <Link
                          href={`/?c=${encodeURIComponent(t.id)}`}
                          aria-current={active ? 'page' : undefined}
                          onClick={closeOnMobile}
                        >
                          <MessagesSquare />
                          <span>{t.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        showOnHover
                        aria-label={`Delete conversation “${t.title}”`}
                        onClick={() => {
                          deleteThread(t.id)
                          if (active) router.push('/')
                        }}
                      >
                        <Trash2 />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = isActiveItem(item, pathname, view)
                const Icon = item.icon
                const count = item.counter === 'upcoming' ? formatCount(counts.upcoming) : null

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={`${item.label} — ${item.description}`}
                    >
                      {item.external ? (
                        // Worker route. A <Link> here would try to resolve it
                        // inside the app router and 404 a live page.
                        <a href={item.href} onClick={closeOnMobile}>
                          <Icon />
                          <span>{item.label}</span>
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={closeOnMobile}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                    {count ? (
                      <SidebarMenuBadge
                        className="tabular text-muted-foreground"
                        title={
                          counts.upcoming == null
                            ? 'Upcoming auction count unavailable'
                            : `${counts.upcoming.toLocaleString('en-US')} upcoming auctions`
                        }
                      >
                        {count}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                )
              })}

              {showDeedToggle ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onToggleDeed}
                    isActive={deedOpen}
                    aria-expanded={deedOpen}
                    aria-controls="deed-panel"
                    tooltip="Deed — ask about this screen"
                  >
                    <DeedRobotMark size={24} decorative={false} className="rounded-md" />
                    <span>Ask Deed here</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {authEnabled && (
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
        )}
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
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
                  <>
                    <Show when="signed-out">
                      <DropdownMenuItem asChild>
                        <Link href="/sign-in" onClick={closeOnMobile}>Sign in</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/sign-up" onClick={closeOnMobile}>Create account</Link>
                      </DropdownMenuItem>
                    </Show>
                    <Show when="signed-in">
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" onClick={closeOnMobile}>Account dashboard</Link>
                      </DropdownMenuItem>
                    </Show>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/sign-in" onClick={closeOnMobile}>Sign in</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/sign-up" onClick={closeOnMobile}>Create account</Link>
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
