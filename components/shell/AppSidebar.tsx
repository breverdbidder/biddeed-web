'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Show, UserButton } from '@clerk/nextjs'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarClock, ChevronsUpDown, FolderKanban, LifeBuoy, MessageSquarePlus, MessagesSquare, Search, Trash2, UserRound, Wand2 } from 'lucide-react'

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
import { useDeedAuth } from '@/lib/deed/deedAuth'
import { CHAT_HISTORY_CONTAINED, deleteThread, loadThreads, subscribeThreads } from '@/lib/deed/threads'
import { deleteThreadRemote, listThreads, notifyThreadsChanged, type ThreadSummary } from '@/lib/deed/threadsRemote'

/** NAV_ITEMS rendered in the Deed group instead of under Workspace. */
const DEED_GROUP_KEYS = new Set(['projects'])

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
    case 'projects':
      // A hash link; the panel it opens has no route of its own.
      return false
    case 'auctions':
      return pathname.startsWith('/radar') && view !== 'calendar'
    case 'calendar':
      return pathname.startsWith('/radar') && view === 'calendar'
    case 'academy':
      return pathname.startsWith('/academy')
    default:
      return pathname === item.href
  }
}

/**
 * Recent conversations (PARITY CP-3).
 *
 * Signed in: the account's threads from /api/deed/threads — recents, and a
 * search box that runs the same route with ?q= — refreshed whenever the
 * thread hook saves (the `biddeed:threads` event). Signed out: the browser
 * store, which is empty by design while CHAT_HISTORY_CONTAINED (issue
 * #20226) — the group simply does not render.
 */
interface RecentItem {
  id: string
  title: string
}

function useRecentThreads(query: string): { recent: RecentItem[]; remove: (id: string) => void; searchable: boolean } {
  const auth = useDeedAuth()
  const signedIn = auth.loaded && auth.signedIn
  const [threads, setThreads] = useState<RecentItem[]>([])

  const refresh = useCallback(() => {
    if (signedIn) {
      void listThreads(query).then((rows: ThreadSummary[] | null) => setThreads((rows ?? []).slice(0, 30).map((r) => ({ id: r.id, title: r.title }))))
      return
    }
    if (CHAT_HISTORY_CONTAINED) {
      setThreads([])
      return
    }
    setThreads(loadThreads().slice(0, 8).map((t) => ({ id: t.id, title: t.title })))
  }, [signedIn, query])

  useEffect(() => {
    refresh()
    return subscribeThreads(refresh)
  }, [refresh])

  const remove = useCallback(
    (id: string) => {
      if (signedIn) {
        void deleteThreadRemote(id).then(() => notifyThreadsChanged())
        return
      }
      deleteThread(id)
    },
    [signedIn]
  )

  return { recent: threads, remove, searchable: signedIn }
}

export default function AppSidebar({ deedOpen, onToggleDeed, authEnabled = false, showDeedToggle = true }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')
  // The conversation lives on '/' (the home page becomes the thread) and on
  // '/chat' (PARITY CP-2). Both read ?c=<id>.
  const isConversation = pathname === '/' || pathname === '/chat'
  const activeThread = isConversation ? searchParams.get('c') : null
  const counts = useAuctionCounts()
  const { isMobile, setOpenMobile } = useSidebar()
  const [query, setQuery] = useState('')
  const { recent, remove, searchable } = useRecentThreads(query)

  // On mobile the nav lives in a Sheet; tapping a link has to close it, or the
  // user lands on the new page with the overlay still covering it.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const newChatActive = pathname === '/chat' && !activeThread
  // Workspace nav = every item except the ones the Deed group renders above it.
  const workspaceItems = NAV_ITEMS.filter((item) => !DEED_GROUP_KEYS.has(item.key))
  const projectsItem = NAV_ITEMS.find((item) => item.key === 'projects')

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
                  <Link href="/chat" aria-current={newChatActive ? 'page' : undefined} onClick={closeOnMobile}>
                    <MessageSquarePlus />
                    <span>New chat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {recent.length > 0 || (searchable && query) ? (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarGroupContent>
              {searchable ? (
                <div className="relative mb-1 px-1">
                  <label htmlFor="deed-thread-search" className="sr-only">
                    Search your chats
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    id="deed-thread-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search chats"
                    className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ) : null}
              {recent.length === 0 && query ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">No chats match “{query}”.</p>
              ) : null}
              <SidebarMenu>
                {recent.map((t) => {
                  const active = activeThread === t.id
                  return (
                    <SidebarMenuItem key={t.id}>
                      <SidebarMenuButton asChild isActive={active} tooltip={t.title}>
                        <Link
                          href={`/chat?c=${encodeURIComponent(t.id)}`}
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
                          remove(t.id)
                          if (active) router.push('/chat')
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

        {/*
          Deed's own rows (PARITY CP-2 §2: New chat · Recents · Projects ·
          Skills · Scheduled). Projects opens the panel on /chat; Skills is a
          labelled "coming" row, never a locked wall (meta prompt CP-2 §1),
          until PARITY-6 ships it; Scheduled is the Deed Watches layer, which
          today is the Alerts page (PARITY-5 grows it).
        */}
        <SidebarGroup>
          <SidebarGroupLabel>Deed</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectsItem ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={`${projectsItem.label} — ${projectsItem.description}`}>
                    <Link href={projectsItem.href} onClick={closeOnMobile}>
                      <FolderKanban />
                      <span>{projectsItem.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton
                  aria-disabled="true"
                  tooltip="Skills — coming: system skills that run live county queries from a slash command"
                  className="cursor-default text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                >
                  <Wand2 />
                  <span>Skills</span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="text-muted-foreground">Coming</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/alerts'}
                  tooltip="Scheduled — Deed Watches: get told when a sale you watch changes"
                >
                  <Link href="/alerts" aria-current={pathname === '/alerts' ? 'page' : undefined} onClick={closeOnMobile}>
                    <CalendarClock />
                    <span>Scheduled</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => {
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
                    onClick={() => {
                      // Every other destination in this drawer closes it via
                      // closeOnMobile; the Deed toggle is the one control that
                      // navigated "in place" and left the sheet up. On mobile
                      // that left the chat panel open but unreachable behind
                      // the drawer (owner report 2026-09-18, Samsung/Chrome):
                      // close the sheet first so the panel takes focus.
                      closeOnMobile()
                      onToggleDeed()
                    }}
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

              {!showDeedToggle ? (
                <SidebarMenuItem>
                  {/*
                    Home and /chat gate the in-place Deed toggle off
                    (showDeedToggle=false), which removed "Ask Deed here" from
                    the mobile drawer entirely on those routes (owner report
                    2026-09-19, Samsung/Chrome, signed in on /): keep the entry
                    visible and route it to the full Deed chat instead of the
                    panel. Same position, directly above Support, same close
                    behavior as every other destination in this drawer.
                  */}
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === '/chat'}
                    tooltip="Deed — open the chat"
                  >
                    <Link href="/chat" onClick={closeOnMobile}>
                      <DeedRobotMark size={24} decorative={false} className="rounded-md" />
                      <span>Ask Deed here</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {/*
                Support tickets (Ariel, 2026-09-06): always visible, directly
                under "Ask Deed here" — Deed is the first stop, a ticket is the
                fallback. App route, reached on biddeed.ai through the Worker
                proxy; <Link> is correct here.
              */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/support'}
                  tooltip="Support — open a ticket or check one"
                >
                  <Link href="/support" aria-current={pathname === '/support' ? 'page' : undefined} onClick={closeOnMobile}>
                    <LifeBuoy />
                    <span>Support</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
