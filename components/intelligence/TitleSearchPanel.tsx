'use client'

import { FormEvent, useState } from 'react'

type TitleResult = { id?: string; address?: string; county?: string; case_number?: string; source?: string; source_url?: string }

export default function TitleSearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TitleResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(null)
    try { const response = await fetch(`/api/title-search?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || 'Unable to search title intelligence.'); setResults(Array.isArray(body?.results) ? body.results : []) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to search title intelligence.') } finally { setLoading(false) }
  }

  return <section className="border border-border bg-card p-5 sm:p-6" aria-labelledby="title-search-title"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Research</p><h2 id="title-search-title" className="mt-1 text-xl font-bold text-foreground">Title intelligence</h2><p className="mt-1 text-sm text-muted-foreground">Search approved public auction and parcel fields with source attribution.</p><form onSubmit={search} className="mt-5 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="title-query">Address, case number, or parcel</label><input id="title-query" required value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 flex-1 border border-input bg-background px-3 text-foreground" placeholder="Address, case number, or parcel" /><button disabled={loading} className="min-h-11 bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{loading ? 'Searching…' : 'Search title data'}</button></form>{error ? <p role="alert" className="mt-4 border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}<div className="mt-5 space-y-3">{results.length === 0 && !loading ? <p className="border border-dashed border-border p-5 text-sm text-muted-foreground">No title-intelligence results yet.</p> : null}{results.map((result, index) => <div key={result.id || `${result.case_number}-${index}`} className="border-t border-border pt-3"><p className="font-semibold text-foreground">{result.address || result.case_number || 'Auction record'}</p><p className="text-sm text-muted-foreground">{result.county || 'County unavailable'}{result.source ? ` · Source: ${result.source}` : ''}</p>{result.source_url ? <a className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href={result.source_url} target="_blank" rel="noreferrer">Open source record</a> : null}</div>)}</div><p className="mt-5 text-xs leading-5 text-muted-foreground">Informational only. This is not a title opinion, legal conclusion, or substitute for professional title review.</p></section>
}
