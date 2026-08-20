'use client'

import { useState } from 'react'
import { downloadCSV } from '@/lib/export'
import { getRecommendation } from '@/lib/scoring'
import type { Auction } from '@/types/auctions'

interface Props {
  auctions: Auction[]
  loading: boolean
  onSelectAuction: (auction: Auction) => void
}

/*
 * NOTE: a sort option for the zoning code was removed along with its column.
 * GET /api/auctions returns 35 fields and the zoning code is not one of them
 * - it is merged from zw_parcels by the DETAIL route only, so the column was
 * empty on every row and the sort control sorted nothing. Offering either one
 * tells the user the data exists and is merely missing here. Both return when
 * the list endpoint joins zoning; see types/auctions.ts, where the
 * detail-only fields are now optional for exactly this reason.
 */
type SpreadsheetSort = 'county' | 'auction_date' | 'assessed_value' | 'property_address' | 'opening_bid'

function fmt(val: number | null | undefined): string {
  if (val == null) return '--'
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtDate(val: string | null): string {
  if (!val) return '--'
  return new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function AuctionSpreadsheet({ auctions, loading, onSelectAuction }: Props) {
  const [sortField, setSortField] = useState<SpreadsheetSort>('auction_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 100

  const handleSort = (field: SpreadsheetSort) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = [...auctions].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    const av = (a as any)[sortField]
    const bv = (b as any)[sortField]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return 0
  })

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)
  const totalPages = Math.ceil(sorted.length / pageSize)

  const SortTh = ({ field, label }: { field: SpreadsheetSort; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-slate-300 select-none whitespace-nowrap"
    >
      {label}
      {sortField === field && <span className="ml-0.5">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>}
    </th>
  )

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-bd-navy-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {sorted.length} auctions {totalPages > 1 && `(page ${page + 1}/${totalPages})`}
        </span>
        <button
          onClick={() => downloadCSV(auctions)}
          className="px-3 py-1 text-xs font-medium bg-bd-navy-500 text-white rounded hover:bg-bd-navy-600 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1000px] w-full divide-y divide-gray-200 dark:divide-slate-800 text-xs">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <SortTh field="county" label="County" />
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase whitespace-nowrap">Case #</th>
              <SortTh field="property_address" label="Address" />
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase whitespace-nowrap">Type</th>
              <SortTh field="auction_date" label="Date" />
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase whitespace-nowrap">Plaintiff</th>
              <SortTh field="assessed_value" label="Just Value" />
              <SortTh field="opening_bid" label="Opening Bid" />
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase whitespace-nowrap">Yr Built</th>
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase whitespace-nowrap">Sqft</th>
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase whitespace-nowrap">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
            {paged.map((a) => {
              const justValue = a.market_value ?? a.assessed_value ?? null
              const score = getRecommendation(justValue, a.opening_bid)
              return (
                <tr
                  key={a.id}
                  onClick={() => onSelectAuction(a)}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-2 py-1.5 text-gray-900 dark:text-slate-200 whitespace-nowrap">{a.county}</td>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-slate-400 font-mono whitespace-nowrap">{a.case_number}</td>
                  <td className="px-2 py-1.5 text-gray-900 dark:text-slate-200 max-w-[200px] truncate">{a.property_address || '--'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={a.auction_type === 'foreclosure' ? 'text-red-500' : 'text-amber-500'}>
                      {a.auction_type === 'foreclosure' ? 'FC' : 'TD'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-slate-400 whitespace-nowrap">{fmtDate(a.auction_date)}</td>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-slate-400 max-w-[120px] truncate">{a.plaintiff || '--'}</td>
                  <td className="px-2 py-1.5 text-gray-900 dark:text-slate-200 whitespace-nowrap tabular">{fmt(justValue)}</td>
                  <td className="px-2 py-1.5 text-gray-900 dark:text-slate-200 whitespace-nowrap tabular">{fmt(a.opening_bid)}</td>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-slate-400 whitespace-nowrap tabular">{a.year_built || '--'}</td>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-slate-400 whitespace-nowrap tabular">{a.living_area_sqft ? a.living_area_sqft.toLocaleString() : '--'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {score.recommendation !== 'UNKNOWN' && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: score.color }}
                      >
                        {score.recommendation}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-slate-800 flex items-center justify-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-700 disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500 dark:text-slate-400">{page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-700 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
