'use client'

import { useState } from 'react'
import { getRecommendation } from '@/lib/scoring'
import ZoningBadge from './ZoningBadge'
import { formatCountyLabel } from '@/lib/counties'
import type { Auction, SortField, SortDirection } from '@/types/auctions'

interface Props {
  auctions: Auction[]
  loading: boolean
  onSelectAuction: (auction: Auction) => void
}

function typeColor(type: string): string {
  switch (type) {
    case 'foreclosure': return 'text-primary dark:text-primary'
    case 'tax_deed': return 'text-foreground dark:text-foreground'
    default: return 'text-muted-foreground dark:text-muted-foreground'
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'foreclosure': return 'FC'
    case 'tax_deed': return 'TD'
    default: return type
  }
}

function formatCurrency(val: number | null): string {
  if (val == null) return '—'
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatDate(val: string | null): string {
  if (!val) return '—'
  const d = new Date(val + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AuctionTable({ auctions, loading, onSelectAuction }: Props) {
  const [sortField, setSortField] = useState<SortField>('auction_date')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = [...auctions].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    const av = a[sortField]
    const bv = b[sortField]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return 0
  })

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground dark:hover:text-muted-foreground select-none"
    >
      {label}
      {sortField === field && (
        <span className="ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
      )}
    </th>
  )

  if (loading) {
    return (
      <div className="bg-card dark:bg-card border border-border dark:border-border rounded-lg overflow-hidden">
        <div className="p-8 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (auctions.length === 0) {
    return (
      <div className="bg-card dark:bg-card border border-border dark:border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground dark:text-muted-foreground">No auctions found matching your filters.</p>
      </div>
    )
  }

  return (
    <div className="bg-card dark:bg-card border border-border dark:border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
          <thead className="bg-muted dark:bg-card/50">
            <tr>
              <SortHeader field="county" label="County" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Case #</th>
              <SortHeader field="property_address" label="Address" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Type</th>
              <SortHeader field="dor_use_code" label="Zone" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Plaintiff</th>
              <SortHeader field="assessed_value" label="Just Value" />
              <SortHeader field="auction_date" label="Date" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
            {sorted.map((auction) => {
              const justValue = auction.market_value ?? auction.assessed_value ?? null
              const score = getRecommendation(justValue, auction.opening_bid)
              return (
                <tr
                  key={auction.id}
                  onClick={() => onSelectAuction(auction)}
                  className="hover:bg-muted dark:hover:bg-card/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 text-sm text-foreground dark:text-foreground whitespace-nowrap">{formatCountyLabel(auction.county)}</td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground dark:text-muted-foreground font-mono whitespace-nowrap">{auction.case_number}</td>
                  <td className="px-3 py-2.5 text-sm text-foreground dark:text-foreground max-w-xs truncate">
                    {auction.property_address || (
                      <span className="text-muted-foreground dark:text-muted-foreground italic">
                        {auction.is_vacant_land ? 'Vacant land' : 'No address'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`text-xs font-medium ${typeColor(auction.auction_type)}`}>
                      {typeLabel(auction.auction_type)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <ZoningBadge dorCode={auction.dor_use_code} />
                  </td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground dark:text-muted-foreground max-w-[160px] truncate">{auction.plaintiff || '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-foreground dark:text-foreground whitespace-nowrap tabular">{formatCurrency(justValue)}</td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground dark:text-muted-foreground whitespace-nowrap">{formatDate(auction.auction_date)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
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
    </div>
  )
}
