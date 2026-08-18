'use client'

import { formatCountyLabel } from '@/lib/counties'
import type { Auction } from '@/types/auctions'

/**
 * Compact auction list for the split view's left pane.
 *
 * AuctionTable is a full-width data grid; dropping it into a ~380px column
 * forces horizontal scrolling on every row. This renders the same rows as
 * stacked cards instead, carrying only what a bidder scans on: address,
 * county, sale type, date and opening bid.
 *
 * Unknown values render as an em dash, never as "$0" or "N/A" - an opening bid
 * that has not been published is not the same as an opening bid of zero, and
 * showing one as the other is the kind of number somebody bids against.
 */

interface Props {
  auctions: Auction[]
  selectedId: number | string | null
  onHighlight: (auction: Auction) => void
  onOpen: (auction: Auction) => void
  total: number
}

function money(v: number | null | undefined): string {
  if (v == null) return '—'
  return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function shortDate(d: string | null | undefined): string {
  if (!d) return '—'
  const parsed = new Date(d + 'T12:00:00Z')
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

const TYPE_BADGE: Record<string, string> = {
  foreclosure: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  tax_deed: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
}

export default function AuctionSidebarList({
  auctions, selectedId, onHighlight, onOpen, total,
}: Props) {
  if (!auctions.length) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-slate-400">
        No auctions match these filters.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-400 shrink-0">
        Showing <span className="font-semibold text-gray-900 dark:text-white">
          {auctions.length.toLocaleString()}
        </span>
        {total > auctions.length && <> of {total.toLocaleString()}</>} auctions
      </div>

      <ul className="overflow-y-auto flex-1 min-h-0 divide-y divide-gray-100 dark:divide-slate-800">
        {auctions.map((a) => {
          const isSelected = selectedId != null && String(selectedId) === String(a.id)
          const type = (a.sale_type || '').toLowerCase()
          return (
            <li key={a.id}>
              {/* One control, two actions: a click highlights the property on
                  the map beside it, and the explicit button opens the full
                  report. Making the whole card navigate away would make the
                  map pane useless - you would never stay long enough to look. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onHighlight(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHighlight(a) }
                }}
                className={`w-full text-left px-3 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-bd-navy-500/10 dark:bg-bd-navy-500/20'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                    {a.property_address || 'Address not published'}
                  </p>
                  {type && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                      TYPE_BADGE[type] || 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30'
                    }`}>
                      {type === 'tax_deed' ? 'Tax Deed' : type === 'foreclosure' ? 'Foreclosure' : type}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {formatCountyLabel(a.county)} County &middot; {shortDate(a.auction_date)}
                </p>

                <div className="flex items-center justify-between mt-2 gap-2">
                  <span className="text-xs text-gray-600 dark:text-slate-300">
                    Opening <span className="font-semibold tabular">{money(a.opening_bid)}</span>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpen(a) }}
                    className="text-xs font-semibold text-bd-navy-600 dark:text-bd-navy-300 underline hover:no-underline min-h-6"
                  >
                    Full report →
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
