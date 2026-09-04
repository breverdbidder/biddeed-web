'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

/**
 * What the user is actually looking at.
 *
 * Deed is not a help widget bolted to the corner of the page — it answers
 * about the screen in front of the user. That only works if "the screen" is a
 * real, readable value, so the workspace keeps its county and sale-type
 * filters in the URL (see components/auctions/AuctionsLayout.tsx) and this
 * hook reads them back. Pathname + query IS the context object; there is no
 * second copy to drift out of sync, and the same string is what a user would
 * paste to a colleague.
 */
export interface DeedContext {
  /** Current pathname, e.g. '/radar'. */
  path: string
  /** Human label for the surface. */
  surface: string
  /** Active county filter slug, or null. */
  county: string | null
  /** Active sale type filter, or null. */
  saleType: string | null
  /** Workspace view: split | table | map | calendar | spreadsheet. */
  view: string | null
  /** Auction id when a parcel detail page is open, or null. */
  parcelId: string | null
}

export function countyLabel(slug: string): string {
  return slug
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

export function useDeedContext(): DeedContext {
  const pathname = usePathname()
  const params = useSearchParams()

  const county = params.get('county')
  const saleType = params.get('sale_type')
  const view = params.get('view')

  return useMemo(() => {
    const parcelMatch = /^\/radar\/([^/]+)$/.exec(pathname)
    let surface = 'the BidDeed.AI home page'
    if (parcelMatch) surface = `auction detail page for record #${parcelMatch[1]}`
    else if (pathname === '/radar') surface = `AuctionRadar workspace (${view || 'split'} view)`
    else if (pathname.startsWith('/order/success')) surface = 'order confirmation page'

    return {
      path: pathname,
      surface,
      county: county || null,
      saleType: saleType || null,
      view: view || null,
      parcelId: parcelMatch ? parcelMatch[1] : null,
    }
  }, [pathname, county, saleType, view])
}

/**
 * The context block that rides along with every message.
 *
 * It goes in the request as text rather than as a side channel because the
 * Worker's /chat/api contract is fixed — `{ messages, county, hook }` — and
 * this build does not get to change it. `county` is also sent as a real field
 * so the Worker's own Supabase grounding scopes its live-data lookup to the
 * same county the user is filtered to.
 */
export function contextPreamble(ctx: DeedContext, counts: {
  upcoming: number | null
  counties: number | null
  total: number | null
}): string {
  const lines = [
    'SCREEN CONTEXT (the user is looking at this right now — resolve "here", "this" and "what is coming up" against it):',
    `- surface: ${ctx.surface}`,
    `- route: ${ctx.path}`,
    `- county filter: ${ctx.county ? countyLabel(ctx.county) + ` (slug ${ctx.county})` : 'none — all counties'}`,
    `- sale type filter: ${ctx.saleType ?? 'none — all types'}`,
  ]
  if (ctx.parcelId) lines.push(`- open auction record id: ${ctx.parcelId}`)

  lines.push(
    'LIVE COUNTS from GET /api/auctions/summary (auctions_summary_ssot()):',
    `- upcoming: ${counts.upcoming ?? 'unavailable'}`,
    `- counties with upcoming sales: ${counts.counties ?? 'unavailable'}`,
    `- total auction records: ${counts.total ?? 'unavailable'}`,
    '',
    'ANSWER RULES:',
    '1. Cite the endpoint or table row behind every figure you state, e.g. "(/api/auctions/summary)" or "(multi_county_auctions, case 42-2021-CA-000414)". If you do not have a source, say you do not have the number. Never estimate.',
    '2. You can act on this screen. To do so, put a directive on its own line at the END of your reply:',
    '   [[ACTION:filter_county:<county_slug>]]  — applies that county filter to the AuctionRadar workspace',
    '   [[ACTION:open_parcel:<auction_id>]]     — opens that auction record',
    '   Emit an action only when the user asked to see, filter, switch to or open something. One action per reply. Say in words what you are doing; the directive itself is stripped before display.',
    '3. Never describe BidDeed.AI as SaaS or a platform subscription — it is an agentic AI ecosystem. Never mention REAI. Do not volunteer patent details; if asked, say only that a provisional patent application has been filed for the underlying method — never state a claim count and never say anything is issued or patented.',
  )

  return lines.join('\n')
}
