'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

export type AlertWatch = {
  id: string
  case_number: string
  county: string
  alert_types: string[]
  max_bid: number | null
  channels: string[]
  timezone: string
  status: 'active' | 'paused' | 'cancelled'
  created_at: string
}

type WatchDraft = {
  case_number: string
  county: string
  max_bid: string
  alert_types: string[]
  channels: string[]
  timezone: string
}

const ALERT_TYPES = [
  ['sale_date_change', 'Sale date changes'],
  ['opening_bid_change', 'Opening bid changes'],
  ['status_change', 'Auction status changes'],
] as const

const DEFAULT_DRAFT: WatchDraft = {
  case_number: '',
  county: '',
  max_bid: '',
  alert_types: ['sale_date_change', 'opening_bid_change', 'status_change'],
  channels: ['email'],
  timezone: 'America/New_York',
}

function idempotencyKey() {
  return crypto.randomUUID()
}

function apiError(response: Response, fallback: string) {
  return response.json().then((body) => body?.error || fallback).catch(() => fallback)
}

export default function AlertDashboard() {
  const [watches, setWatches] = useState<AlertWatch[]>([])
  const [draft, setDraft] = useState<WatchDraft>(DEFAULT_DRAFT)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const activeCount = useMemo(
    () => watches.filter((watch) => watch.status === 'active').length,
    [watches],
  )

  const loadWatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/alerts/watches', { credentials: 'include' })
      if (!response.ok) throw new Error(await apiError(response, 'Unable to load your alerts.'))
      const body = await response.json()
      setWatches(Array.isArray(body?.watches) ? body.watches : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your alerts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadWatches()
  }, [loadWatches])

  function toggleAlertType(value: string) {
    setDraft((current) => ({
      ...current,
      alert_types: current.alert_types.includes(value)
        ? current.alert_types.filter((item) => item !== value)
        : [...current.alert_types, value],
    }))
  }

  async function createWatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/alerts/watches', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify({
          ...draft,
          county: draft.county.trim().toLowerCase(),
          case_number: draft.case_number.trim().toUpperCase(),
          max_bid: draft.max_bid === '' ? null : Number(draft.max_bid),
        }),
      })
      if (!response.ok) throw new Error(await apiError(response, 'Unable to create this alert.'))
      const body = await response.json()
      if (body?.watch) {
        setWatches((current) => [body.watch, ...current.filter((watch) => watch.id !== body.watch.id)])
      }
      setDraft(DEFAULT_DRAFT)
      setNotice('Alert saved. We will notify you when the selected auction changes.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create this alert.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(watch: AlertWatch) {
    const nextStatus = watch.status === 'active' ? 'paused' : 'active'
    setError(null)
    setWatches((current) => current.map((item) => item.id === watch.id ? { ...item, status: nextStatus } : item))
    const response = await fetch(`/api/alerts/watches/${encodeURIComponent(watch.id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (!response.ok) {
      setWatches((current) => current.map((item) => item.id === watch.id ? watch : item))
      setError(await apiError(response, 'Unable to update this alert.'))
    }
  }

  async function cancelWatch(watch: AlertWatch) {
    setError(null)
    setWatches((current) => current.map((item) => item.id === watch.id ? { ...item, status: 'cancelled' } : item))
    const response = await fetch(`/api/alerts/watches/${encodeURIComponent(watch.id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) {
      setWatches((current) => current.map((item) => item.id === watch.id ? watch : item))
      setError(await apiError(response, 'Unable to cancel this alert.'))
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="alerts-title">
      <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Auction alerts</p>
          <h1 id="alerts-title" className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">Stay ahead of the auction clock.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create private watches for auctions you are evaluating. Alerts are tied to your account and never expose raw contact details in the dashboard.</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{activeCount}</span> active {activeCount === 1 ? 'watch' : 'watches'}
        </div>
      </header>

      {error ? <div role="alert" className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {notice ? <div role="status" className="border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">{notice}</div> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form onSubmit={createWatch} className="space-y-5 border border-border bg-card p-5 sm:p-6" aria-labelledby="create-alert-title">
          <div>
            <h2 id="create-alert-title" className="text-lg font-bold text-foreground">Create an alert</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use a case number from the verified auction inventory.</p>
          </div>
          <label className="block text-sm font-semibold text-foreground">Case number<input required value={draft.case_number} onChange={(event) => setDraft({ ...draft, case_number: event.target.value })} className="mt-2 min-h-11 w-full border border-input bg-background px-3 text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" placeholder="422021CA000414CAAXXX" /></label>
          <label className="block text-sm font-semibold text-foreground">County<input required value={draft.county} onChange={(event) => setDraft({ ...draft, county: event.target.value })} className="mt-2 min-h-11 w-full border border-input bg-background px-3 text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" placeholder="Marion" /></label>
          <label className="block text-sm font-semibold text-foreground">Maximum bid <span className="font-normal text-muted-foreground">(optional)</span><input inputMode="decimal" value={draft.max_bid} onChange={(event) => setDraft({ ...draft, max_bid: event.target.value })} className="mt-2 min-h-11 w-full border border-input bg-background px-3 text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" placeholder="82000" /></label>
          <fieldset>
            <legend className="text-sm font-semibold text-foreground">Notify me about</legend>
            <div className="mt-3 space-y-3">
              {ALERT_TYPES.map(([value, label]) => <label key={value} className="flex items-start gap-3 text-sm text-foreground"><input type="checkbox" checked={draft.alert_types.includes(value)} onChange={() => toggleAlertType(value)} className="mt-1 size-4 accent-[hsl(var(--primary))]" />{label}</label>)}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold text-foreground">Timezone<select value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} className="mt-2 min-h-11 w-full border border-input bg-background px-3 text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"><option>America/New_York</option><option>UTC</option></select></label>
          <p className="text-xs leading-5 text-muted-foreground">Email delivery requires a separate confirmed consent record. Informational only—this is not legal, financial, or investment advice.</p>
          <button disabled={submitting || draft.alert_types.length === 0} className="min-h-11 w-full bg-primary px-4 text-sm font-bold text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Saving…' : 'Save auction alert'}</button>
        </form>

        <div className="space-y-4" aria-live="polite">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-foreground">Your watches</h2><button type="button" onClick={() => void loadWatches()} className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Refresh</button></div>
          {loading ? <div className="border border-border bg-card p-6 text-sm text-muted-foreground">Loading your private alerts…</div> : null}
          {!loading && watches.length === 0 ? <div className="border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">No alerts yet. Create your first watch to track a verified auction.</div> : null}
          {!loading && watches.length > 0 ? <ul className="space-y-3">{watches.map((watch) => <li key={watch.id} className="border border-border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm font-bold text-foreground">{watch.case_number}</p><p className="mt-1 text-sm text-muted-foreground">{watch.county} County · {watch.max_bid == null ? 'No bid ceiling' : `$${watch.max_bid.toLocaleString()} ceiling`}</p></div><span className="border border-border px-2 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{watch.status}</span></div><div className="mt-4 flex flex-wrap gap-2">{watch.alert_types.map((type) => <span key={type} className="bg-secondary px-2 py-1 text-xs text-secondary-foreground">{type.replaceAll('_', ' ')}</span>)}</div><div className="mt-4 flex gap-4 text-sm"><button type="button" onClick={() => void updateStatus(watch)} disabled={watch.status === 'cancelled'} className="font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-40">{watch.status === 'active' ? 'Pause' : 'Resume'}</button><button type="button" onClick={() => void cancelWatch(watch)} disabled={watch.status === 'cancelled'} className="font-semibold text-destructive underline-offset-4 hover:underline disabled:opacity-40">Cancel</button></div></li>)}</ul> : null}
        </div>
      </div>
    </section>
  )
}

