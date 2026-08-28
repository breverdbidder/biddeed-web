'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronsUpDown, UserRound } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
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

interface Props {
  deedOpen: boolean
  onToggleDeed: () => void
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
    case 'home':
      return pathname === '/'
    case 'auctions':
      return pathname.startsWith('/radar') && view !== 'calendar'
    case 'calendar':
      return pathname.startsWith('/radar') && view === 'calendar'
    default:
      return pathname === item.href
  }
}

export default function AppSidebar({ deedOpen, onToggleDeed }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const view = searchParams.get('view')
  const counts = useAuctionCounts()
  const { isMobile, setOpenMobile } = useSidebar()

  // On mobile the nav lives in a Sheet; tapping a link has to close it, or the
  // user lands on the new page with the overlay still covering it.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="BidDeed.AI">
              <Link href="/" onClick={closeOnMobile}>
                <span
                  aria-hidden
                  className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-bd-orange text-sm font-extrabold text-primary-foreground"
                >
                  B
                </span>
                <span className="grid text-left leading-tight">
                  <span className="truncate text-sm font-bold text-sidebar-foreground">
                    Bid<span className="text-bd-orange">Deed</span>.AI
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

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onToggleDeed}
                  isActive={deedOpen}
                  aria-expanded={deedOpen}
                  aria-controls="deed-panel"
                  tooltip="Deed — the BidDeed agent"
                >
                  <DeedRobotMark size={24} decorative={false} className="rounded-md" />
                  <span>
                    Deed <span className="sr-only">voice chatbot</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
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
