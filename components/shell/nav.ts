import type { LucideIcon } from 'lucide-react'
import { CalendarDays, FileText, Gavel, Home, MapPinned, Search } from 'lucide-react'

/**
 * Primary navigation.
 *
 * `external: true` means the path is served by the Cloudflare Worker, not by
 * this Next app. Those MUST render as a plain <a>: next/link would do a
 * client-side transition into the app router, find no matching route and paint
 * a 404 over a page that exists perfectly well at the edge.
 */
export interface NavItem {
  key: string
  label: string
  href: string
  icon: LucideIcon
  external?: boolean
  /** Which live counter, if any, this item displays. */
  counter?: 'upcoming'
  description: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/',
    icon: Home,
    description: 'Auction Intelligence overview',
  },
  {
    key: 'auctions',
    label: 'Auctions',
    href: '/radar',
    icon: Gavel,
    counter: 'upcoming',
    description: 'Split, table, map and spreadsheet views',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    href: '/radar?view=calendar',
    icon: CalendarDays,
    description: 'What sells, and when',
  },
  {
    key: 'discover',
    label: 'Discover',
    href: '/discover',
    icon: Search,
    description: 'Search source-backed auction inventory',
  },
  {
    key: 'counties',
    label: 'Counties',
    href: '/counties',
    icon: MapPinned,
    external: true,
    description: 'County coverage pages (Worker)',
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/buy-report',
    icon: FileText,
    external: true,
    description: 'Clear to Bid reports (Worker)',
  },
]

/** Worker-served account links. None of these are app routes. */
export const ACCOUNT_LINKS: { label: string; href: string }[] = [
  { label: 'Plans & pricing', href: '/subscribe' },
  { label: 'Buy a report', href: '/buy-report' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
]
