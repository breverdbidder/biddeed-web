'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Search, MapPinned, CalendarDays, ShieldCheck, AlertTriangle } from 'lucide-react'
import { apiUrl } from '@/lib/api'

type Auction = {
  id: string | number
  county?: string | null
  city?: string | null
  case_number?: string | null
  property_address?: string | null
  auction_date?: string | null
  sale_type?: string | null
  auction_status?: string | null
  opening_bid?: number | null
  source_url?: string | null
  latitude?: number | null
  longitude?: number | null
}

type Summary = { total?: number; upcoming?: number; counties?: number; counties_upcoming?: number }

function money(value: number | null | undefined) {
  return value == null ? '—' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function asArray(value: unknown): Auction[] {
  return Array.isArray(value) ? (value as Auction[]) : []
}

export default function DiscoveryPage() {
  const [query, setQuery] = useState('')
  const [county, setCounty] = useState('')
  const [saleType, setSaleType] = useState('')
  const [rows, setRows] = useState<Auction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Search by address, case number, city, ZIP, parcel, or county.')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/api/auctions/summary'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setSummary(json ?? null))
      .catch(() => setSummary(null))
  }, [])

  const coverageLabel = useMemo(() => {
    if (!summary) return 'Coverage status is loading'
    const counties = summary.counties_upcoming ?? summary.counties ?? 0
    return counties > 0 ? `${counties} counties with upcoming inventory` : 'Coverage unavailable for this request'
  }, [summary])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const clean = query.trim().slice(0, 80)
    if (!clean && !county && !saleType) {
      setMessage('Enter a search term or choose a filter before searching.')
      setRows([])
      setSearched(true)
      return
    }
    setLoading(true)
    setSearched(true)
    setMessage('Querying source-backed auction inventory…')
    const params = new URLSearchParams({ limit: '50', upcoming: 'true' })
    if (county) params.set('county', county.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
    if (saleType) params.set('sale_type', saleType)
    const isCaseLike = /\d/.test(clean) && /[-/]/.test(clean)
    if (clean) params.set(isCaseLike ? 'case_number' : 'address', clean)
    try {
      const response = await fetch(apiUrl(`/api/auctions?${params.toString()}`), { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Search failed')
      const next = asArray(json?.data)
      setRows(next)
      setMessage(next.length ? `${next.length} source-backed result${next.length === 1 ? '' : 's'} · capped at 50` : 'No matching source-backed inventory was found. Try a broader term or another county.')
    } catch (error) {
      setRows([])
      setMessage(error instanceof Error ? error.message : 'Search unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-full bg-background px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">P1 Discovery</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Find the next auction worth your attention.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Search BidDeed’s source-backed auction inventory by location or case. Results are bounded, freshness-labeled, and never presented as legal, financial, or investment advice.</p>
        </div>

        <form onSubmit={submit} className="mt-8 border-y border-border py-5" aria-label="Auction discovery search">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-3 border border-border bg-card px-4 py-3 focus-within:border-primary">
              <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="sr-only">Search auctions</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" placeholder="Address, city, ZIP, parcel, case number…" />
            </label>
            <label className="border border-border bg-card px-3 py-2 text-sm lg:w-48">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">County slug</span>
              <input value={county} onChange={(e) => setCounty(e.target.value)} maxLength={40} className="mt-1 w-full bg-transparent outline-none" placeholder="miami_dade" />
            </label>
            <label className="border border-border bg-card px-3 py-2 text-sm lg:w-48">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Sale type</span>
              <select value={saleType} onChange={(e) => setSaleType(e.target.value)} className="mt-1 w-full bg-transparent outline-none">
                <option value="">All sale types</option>
                <option value="foreclosure">Foreclosure</option>
                <option value="tax_deed">Tax deed</option>
              </select>
            </label>
            <button type="submit" disabled={loading} className="bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-bd-orange-600 disabled:opacity-60">{loading ? 'Searching…' : 'Search'}</button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
        </form>

        <div className="grid gap-4 border-b border-border py-6 sm:grid-cols-3">
          <div className="flex items-start gap-3"><MapPinned className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" /><div><p className="text-sm font-bold">Coverage</p><p className="mt-1 text-sm text-muted-foreground">{coverageLabel}</p></div></div>
          <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" /><div><p className="text-sm font-bold">Upcoming scope</p><p className="mt-1 text-sm text-muted-foreground">{summary?.upcoming?.toLocaleString('en-US') ?? '—'} scheduled records</p></div></div>
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" /><div><p className="text-sm font-bold">Evidence rule</p><p className="mt-1 text-sm text-muted-foreground">Every result retains its source link.</p></div></div>
        </div>

        {searched && rows.length > 0 && <div className="mt-8 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="mb-3 text-left text-lg font-bold">Upcoming source-backed inventory</caption><thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-3 pr-4">Property</th><th className="py-3 pr-4">County</th><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Sale</th><th className="py-3 pr-4">Opening bid</th><th className="py-3">Source</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)} className="border-b border-border"><td className="py-4 pr-4"><div className="font-semibold">{row.property_address || 'Address not published'}</div><div className="mt-1 text-xs text-muted-foreground">{row.city || '—'} · {row.case_number || 'Case unavailable'}</div></td><td className="py-4 pr-4">{row.county || '—'}</td><td className="py-4 pr-4">{row.auction_date || '—'}</td><td className="py-4 pr-4">{row.sale_type || '—'}</td><td className="py-4 pr-4">{money(row.opening_bid)}</td><td className="py-4">{row.source_url ? <a className="font-semibold text-primary underline" href={row.source_url} target="_blank" rel="noreferrer">View source</a> : <span className="text-muted-foreground">Unavailable</span>}</td></tr>)}</tbody></table></div>}
        {searched && rows.length === 0 && <div className="mt-8 flex items-start gap-3 border border-border bg-card px-5 py-4 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p>No result table is shown without source-backed records. Coverage varies by county and sale type; confirm material facts with the relevant clerk or official source.</p></div>}
      </div>
    </section>
  )
}
