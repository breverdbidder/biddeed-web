'use client'

import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Gavel, Landmark } from 'lucide-react'

import { formatCountyLabel } from '@/lib/counties'
import { intentToRadarHref } from '@/lib/deed/intent'
import type { AuctionCardData, CardSet } from '@/lib/deed/threads'
import { cn } from '@/lib/utils'

/**
 * The answer-as-UI half of a Deed turn.
 *
 * Rows come from /api/auctions — the same query the workspace runs — so what a
 * customer sees here is what they will see on /radar, to the row. Unknown
 * values render as an em-dash, never as $0: "$0 opening bid" and "we do not
 * have the opening bid" are different facts and only one is ever true.
 */

export function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
}

export function saleDate(iso: string | null | undefined): { day: string; mon: string; full: string } {
  if (!iso) return { day: '—', mon: '', full: 'Date pending' }
  const d = new Date(iso + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return { day: '—', mon: '', full: 'Date pending' }
  return {
    day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }),
    mon: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    full: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
  }
}

function typeLabel(t: string | null | undefined): string {
  if (t === 'tax_deed') return 'Tax deed'
  if (t === 'foreclosure') return 'Foreclosure'
  return t ? t.replace(/_/g, ' ') : 'Sale'
}

function AuctionCard({ row }: { row: AuctionCardData }) {
  const d = saleDate(row.auction_date)
  const isTax = row.sale_type === 'tax_deed'
  const address = row.property_address?.trim() || 'Address pending'
  const city = row.city?.trim()
    ? row.city.trim().toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : null
  const place = [city, formatCountyLabel(row.county) + ' County'].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/radar/${encodeURIComponent(row.id)}`}
      className={cn(
        'group flex min-h-[9.5rem] w-full min-w-0 flex-col rounded-xl border border-border bg-card p-4 text-left',
        'shadow-[0_1px_0_rgba(31,27,22,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border bg-background py-1.5 leading-none"
          title={d.full}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d.mon || '—'}</span>
          <span className="tabular mt-0.5 text-lg font-bold text-foreground">{d.day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground" title={address}>
            {address}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{place}</p>
          <span
            className={cn(
              'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              isTax ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'
            )}
          >
            {isTax ? <Landmark className="size-3" aria-hidden /> : <Gavel className="size-3" aria-hidden />}
            {typeLabel(row.sale_type)}
          </span>
        </div>
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-3 pt-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Opening bid</dt>
          <dd className="tabular text-base font-semibold text-foreground">{money(row.opening_bid)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Assessed</dt>
          <dd className="tabular text-base font-semibold text-foreground">{money(row.assessed_value)}</dd>
        </div>
      </dl>
      <span className="sr-only">Open auction details</span>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="min-h-[9.5rem] animate-pulse rounded-xl border border-border bg-card p-4">
      <div className="flex gap-3">
        <div className="h-12 w-12 rounded-lg bg-secondary" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-3/4 rounded bg-secondary" />
          <div className="h-3 w-1/2 rounded bg-secondary" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="h-5 w-20 rounded bg-secondary" />
        <div className="h-5 w-20 rounded bg-secondary" />
      </div>
    </div>
  )
}

export default function AuctionCards({ set }: { set: CardSet }) {
  const { intent, rows, total, loading, error, widened, bidUnknown } = set
  const radarHref = intentToRadarHref(intent)
  const where = intent.countyName ? ` in ${intent.countyName} County` : ' in Florida'
  const typeWord = intent.saleType === 'tax_deed' ? 'tax deed ' : intent.saleType === 'foreclosure' ? 'foreclosure ' : ''
  const heading = widened ? `Next ${typeWord}sales${where}` : intent.label

  return (
    <section aria-label={intent.label} className="my-1">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          {heading}
        </h3>
        {!loading && total != null && total > 0 ? (
          <p className="tabular text-xs text-muted-foreground">
            {total.toLocaleString('en-US')} {total === 1 ? 'sale' : 'sales'} match · showing {Math.min(rows.length, total)}
          </p>
        ) : null}
      </div>

      {widened && !loading ? (
        <p className="mb-3 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-secondary-foreground">
          No {typeWord}sales{where} {intent.when ?? 'in that window'} — these are the next scheduled sales instead.
        </p>
      ) : null}
      {bidUnknown && !loading && rows.length > 0 ? (
        <p className="mb-3 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-secondary-foreground">
          The clerk has not published opening bids for these sales yet, so none can be confirmed under your cap.
          Bids usually post in the final days before the sale.
        </p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          The auction list did not load ({error}). The rows are still there —{' '}
          <Link href={radarHref} className="font-medium text-primary underline underline-offset-2">
            open them in Auctions
          </Link>
          .
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          No live sales match that window. Widen the dates or drop the county, or{' '}
          <Link href={radarHref} className="font-medium text-primary underline underline-offset-2">
            browse every upcoming sale
          </Link>
          .
        </p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          {rows.map((r) => (
            <li key={r.id} className="min-w-0">
              <AuctionCard row={r} />
            </li>
          ))}
        </ul>
      )}

      {!loading && rows.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href={radarHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary"
          >
            See all in Auctions <ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <p className="text-xs text-muted-foreground">
            Same rows as the workspace, updated as the clerks publish.
          </p>
        </div>
      ) : null}
    </section>
  )
}
