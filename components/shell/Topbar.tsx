'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { PanelLeft } from 'lucide-react'

import { Separator } from '@/components/ui/separator'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { formatCount, useAuctionCounts } from './useAuctionCounts'
import { useTheme } from '@/lib/theme-context'
import DeedRobotMark from '@/components/deed/DeedRobotMark'

interface Props {
  deedOpen: boolean
  onToggleDeed: () => void
  /** false on '/', where the page itself is the conversation. */
  showDeedToggle?: boolean
}

/**
 * Persistent topbar: sidebar trigger, route label, live inventory counters and
 * the Deed toggle.
 *
 * Two rules this component exists to enforce:
 *
 *  1. Every number here comes from /api/auctions/summary via useAuctionCounts,
 *     which returns null rather than a fallback. A count that is unknown paints
 *     an em-dash. Nothing in this bar is ever hardcoded, because a stale
 *     hardcoded "67 counties" is indistinguishable from a working one and that
 *     is exactly how the "0 auctions across 0 Florida counties" incident got
 *     shipped.
 *
 *  2. The counters are `tabular` (font-variant-numeric: tabular-nums). Figures
 *     that jitter as they update read as amateur on a surface an investor is
 *     about to trust with a bid.
 *
 * Below 640px the counter cluster is hidden -- it is duplicated in the sidebar
 * badge and on the page itself, and at 320px it would push the Deed control off
 * the bar. Hiding a duplicate is not the same as losing information.
 */

function routeLabel(pathname: string, view: string | null): string {
  if (pathname === '/') return 'Deed'
  if (pathname === '/radar') return view === 'calendar' ? 'Auction calendar' : 'AuctionRadar'
  if (pathname.startsWith('/radar/')) return 'Auction detail'
  if (pathname.startsWith('/order')) return 'Order'
  if (pathname === '/discover') return 'Discover'
  if (pathname === '/alerts') return 'Alerts'
  return 'BidDeed.AI'
}

export default function Topbar({ deedOpen, onToggleDeed, showDeedToggle = true }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const counts = useAuctionCounts()
  const { isMobile } = useSidebar()
  const { theme, toggleTheme } = useTheme()

  const label = routeLabel(pathname, searchParams.get('view'))

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border',
        'bg-sidebar/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-sidebar/80 sm:px-4'
      )}
    >
      {/*
        SidebarTrigger renders its own accessible name and a 44px hit area via
        the button primitive. On mobile it opens the Sheet; on desktop it
        collapses the rail to icons.
      */}
      <SidebarTrigger aria-label="Toggle navigation sidebar" className="border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
        <PanelLeft aria-hidden />
      </SidebarTrigger>

      <Separator orientation="vertical" className="mr-1 h-5 bg-sidebar-border" />

      <Link
        href="/"
        className="truncate text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {label}
      </Link>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <dl className="hidden items-center gap-4 text-xs sm:flex">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Upcoming</dt>
            <dd
              className="tabular font-semibold text-foreground"
              title={
                counts.upcoming == null
                  ? 'Upcoming auction count unavailable'
                  : `${counts.upcoming.toLocaleString('en-US')} upcoming auctions`
              }
            >
              {counts.loading ? '·' : formatCount(counts.upcoming)}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Counties</dt>
            <dd
              className="tabular font-semibold text-foreground"
              title={
                counts.counties == null
                  ? 'County count unavailable'
                  : `${counts.counties.toLocaleString('en-US')} counties with upcoming inventory`
              }
            >
              {counts.loading ? '·' : formatCount(counts.counties)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="mr-1 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden>{theme === 'dark' ? '☼' : '☾'}</span>
          <span className={isMobile ? 'sr-only' : undefined}>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {showDeedToggle ? (
          <button
            type="button"
            onClick={onToggleDeed}
            aria-expanded={deedOpen}
            aria-controls="deed-panel"
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium',
              'outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              deedOpen
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <DeedRobotMark size={24} decorative={false} className="rounded-md" />
            <span className={isMobile ? 'sr-only' : undefined}>Ask Deed</span>
          </button>
        ) : null}
      </div>
    </header>
  )
}
