'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import PanelState from './PanelState'

type SavedSearch = { id: string; name: string; query: Record<string, unknown>; status: string; updated_at: string }
type Notice = { kind: 'success' | 'error'; message: string }

async function readMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null)
  return body?.error || fallback
}

export default function SavedSearchesPanel() {
  const [items, setItems] = useState<SavedSearch[]>([])
  const [name, setName] = useState('')
  const [query, setQuery] = useState('{"county":""}')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setNotice(null); setAuthRequired(false)
    try {
      const response = await fetch('/api/saved-searches', { credentials: 'include' })
      if (response.status === 401) { setAuthRequired(true); return }
      if (!response.ok) throw new Error(await readMessage(response, 'Unable to load saved searches.'))
      const body = await response.json(); setItems(body.searches ?? [])
    } catch (cause) { setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : 'Unable to load saved searches.' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice(null)
    try {
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(query) } catch { throw new Error('Criteria must be valid JSON before it can be saved.') }
      const response = await fetch('/api/saved-searches', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ name, query: parsed }) })
      if (response.status === 401) { setAuthRequired(true); return }
      if (!response.ok) throw new Error(await readMessage(response, 'Unable to save this search.'))
      const body = await response.json(); setItems((current) => [body.search, ...current.filter((item) => item.id !== body.search.id)]); setName(''); setNotice({ kind: 'success', message: body.replayed ? 'That saved search already existed; it is now at the top of your list.' : 'Saved search created.' })
    } catch (cause) { setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : 'Unable to save this search.' }) }
    finally { setSaving(false) }
  }

  async function archive(id: string) {
    setNotice(null)
    const response = await fetch(`/api/saved-searches/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
    if (response.status === 401) { setAuthRequired(true); return }
    if (response.ok) { setItems((current) => current.filter((item) => item.id !== id)); setNotice({ kind: 'success', message: 'Saved search archived.' }) }
    else setNotice({ kind: 'error', message: await readMessage(response, 'Unable to archive this search.') })
  }

  return <section className="border border-border bg-card p-5 sm:p-6" aria-labelledby="saved-searches-title"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Workspace</p><h2 id="saved-searches-title" className="mt-1 text-xl font-bold text-foreground">Saved searches</h2><p className="mt-1 text-sm text-muted-foreground">Keep repeatable county and auction criteria ready for your next review.</p></div><button type="button" onClick={() => void load()} className="min-h-10 text-sm font-semibold text-primary underline-offset-4 hover:underline">Refresh</button></div>{authRequired ? <div className="mt-4"><PanelState kind="auth" title="Sign in to save searches" message="Saved searches are private to your account and sync across devices." actionLabel="Sign in" onAction={() => { window.location.href = '/sign-in?redirect_url=/alerts' }} /></div> : null}{notice ? <div className="mt-4"><PanelState kind={notice.kind} title={notice.kind === 'success' ? 'Saved search updated' : 'Saved search needs attention'} message={notice.message} /></div> : null}<form onSubmit={create} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end"><label className="text-sm font-semibold text-foreground">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-11 w-full border border-input bg-background px-3 font-normal text-foreground" placeholder="Broward high-equity" /></label><label className="text-sm font-semibold text-foreground">Criteria JSON<input required value={query} onChange={(event) => setQuery(event.target.value)} className="mt-2 min-h-11 w-full border border-input bg-background px-3 font-mono text-xs font-normal text-foreground" aria-describedby="criteria-help" /></label><button disabled={saving || authRequired} className="min-h-11 bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving ? 'Saving…' : 'Save search'}</button></form><p id="criteria-help" className="mt-2 text-xs text-muted-foreground">Stored as private criteria; never place contact data in search JSON.</p><div className="mt-6 space-y-2">{loading ? <PanelState kind="loading" title="Loading saved searches" message="Checking your private saved-search collection…" /> : null}{!loading && !authRequired && items.length === 0 ? <PanelState kind="empty" title="No saved searches yet" message="Save a county or auction filter to reuse it later." /> : null}{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3"><div><p className="font-semibold text-foreground">{item.name}</p><p className="text-xs text-muted-foreground">Updated {new Date(item.updated_at).toLocaleDateString()}</p></div><button type="button" onClick={() => void archive(item.id)} className="min-h-10 text-sm font-semibold text-destructive underline-offset-4 hover:underline">Archive</button></div>)}</div></section>
}
