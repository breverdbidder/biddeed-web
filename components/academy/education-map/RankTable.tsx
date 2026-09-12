'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'

export interface RankRow {
  rank: number
  name: string
  operator: string
  categoryLabel: string
  score: number
  priceBand: string
  priceSort: number
  satisfaction: string
  satisfactionSort: number
  proofLabel: string
  bestPlatform: string
  take: string
}

type SortKey = 'rank' | 'priceSort' | 'satisfactionSort' | 'score'

const HEADERS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: 'rank', label: 'Rank' },
  { key: null, label: 'Name' },
  { key: null, label: 'Category' },
  { key: 'priceSort', label: 'Price band' },
  { key: 'satisfactionSort', label: 'Satisfaction' },
  { key: null, label: 'Proof type' },
  { key: null, label: 'Best platform' },
  { key: 'score', label: 'Score' },
]

/**
 * Sortable candidate rank table for the education map (#education-map).
 * Client component: sort state only, no data fetching — rows arrive fully
 * rendered from the server component so the table stays SEO-readable.
 */
export function RankTable({ rows, takeByName }: { rows: RankRow[]; takeByName: Record<string, string> }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rank', dir: 1 })

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir)
    return copy
  }, [rows, sort])

  return (
    <div className="not-prose overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-secondary text-left">
            {HEADERS.map((h) => (
              <th key={h.label} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
                {h.key ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSort((s) => ({ key: h.key as SortKey, dir: s.key === h.key ? (s.dir * -1) as 1 | -1 : 1 }))
                    }
                    className="inline-flex items-center gap-1 hover:text-primary"
                  >
                    {h.label}
                    <ArrowUpDown aria-hidden className="size-3" />
                  </button>
                ) : (
                  h.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.name} className="border-t border-border align-top">
              <td className="px-3 py-2">
                {r.rank <= 3 ? (
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {r.rank}
                  </span>
                ) : (
                  <span className="px-2 text-muted-foreground">{r.rank}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="font-semibold text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.operator}</div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.categoryLabel}</td>
              <td className="px-3 py-2 font-medium text-foreground">{r.priceBand}</td>
              <td className="px-3 py-2"><SatisfactionPill grade={r.satisfaction} /></td>
              <td className="px-3 py-2 text-muted-foreground">{r.proofLabel}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.bestPlatform}</td>
              <td className="px-3 py-2 font-bold text-primary">{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">{Object.keys(takeByName).length} candidate takes available below in the scorecards.</p>
    </div>
  )
}

export function SatisfactionPill({ grade }: { grade: string }) {
  const cls =
    grade === 'S+'
      ? 'bg-primary text-primary-foreground'
      : grade === 'S' || grade === 'S-'
        ? 'border border-primary text-primary'
        : grade === 'M'
          ? 'bg-secondary text-secondary-foreground border border-border'
          : grade.startsWith('W')
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{grade}</span>
  )
}
