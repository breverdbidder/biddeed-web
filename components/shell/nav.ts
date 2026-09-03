import type { LucideIcon } from 'lucide-react'
import { Bell, CalendarDays, FileText, Gavel, MapPinned, Search } from 'lucide-react'

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
    key: 'auctions',
    label: 'Auctions',
    href: '/radar',
    icon: Gavel,
    counter: 'upcoming',
    description: 'Every upcoming sale — map, table, calendar and spreadsheet',
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
    description: 'Search auction inventory by county, case or address',
  },
  {
    key: 'alerts',
    label: 'Alerts',
    href: '/alerts',
    icon: Bell,
    description: 'Get told when a sale you watch changes',
  },
  {
    key: 'counties',
    label: 'Counties',
    href: '/counties',
    icon: MapPinned,
    external: true,
    description: 'Coverage and calendars for all 67 counties',
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/buy-report',
    icon: FileText,
    external: true,
    description: 'SIGNAL$ Property Reports — one property, all 18 sections',
  },
]

/** Worker-served account links. None of these are app routes. */
export const ACCOUNT_LINKS: { label: string; href: string }[] = [
  { label: 'Plans & pricing', href: '/subscribe' },
  { label: 'Buy a report', href: '/buy-report' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
]
