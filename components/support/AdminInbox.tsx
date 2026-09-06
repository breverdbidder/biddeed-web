'use client'

import { useCallback, useEffect, useState } from 'react'

const STATUSES = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed', 'all'] as const
const SET_STATUSES = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'] as const
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

type Ticket = {
  id: string
  ticket_number: string
  status: string
  category: string
  priority: string
  subject: string
  message: string
  name: string | null
  email: string
  clerk_user_id: string | null
  plan_tier: string | null
  page_url: string | null
  user_agent: string | null
  channel: string
  admin_notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  resolved_at: string | null
}

const PRIORITY_CLASS: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  high: 'bg-primary text-primary-foreground',
  normal: 'bg-secondary text-secondary-foreground',
  low: 'bg-muted text-muted-foreground',
}

function when(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(iso)) + ' ET'
  } catch {
    return iso
  }
}

export default function AdminInbox() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('open')
  const [token, setToken] = useState('')
  const [useToken, setUseToken] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [via, setVia] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const headers = useCallback((): HeadersInit => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (useToken && token) h['X-Admin-Support-Token'] = token
    return h
  }, [useToken, token])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/support-tickets-admin?status=${encodeURIComponent(status)}&limit=100`, {
        headers: headers(),
        cache: 'no-store',
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; tickets?: Ticket[]; via?: string; error?: string }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`)
      setTickets(body.tickets ?? [])
      setVia(body.via ?? null)
    } catch (err) {
      setTickets([])
      setVia(null)
      setError(err instanceof Error ? err.message : 'Could not load tickets.')
    } finally {
      setLoading(false)
    }
  }, [status, headers])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null)
    const res = await fetch('/api/support-tickets-admin', { method: 'PATCH', headers: headers(), body: JSON.stringify({ id, ...body }) })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; ticket?: Ticket; error?: string }
    if (!res.ok || !data.ticket) {
      setError(data.error || 'Update failed.')
      return
    }
    const updated = data.ticket
    setTickets((list) =>
      status === 'all' || updated.status === status ? list.map((t) => (t.id === id ? updated : t)) : list.filter((t) => t.id !== id),
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="inbox-title">
      <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Founder only</p>
          <h1 id="inbox-title" className="font-display mt-2 text-3xl font-medium tracking-tight text-foreground">Support inbox</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tickets from biddeed.ai/support. Access is your signed-in account (listed in support_admins)
            {via ? ` — authenticated via ${via}.` : '.'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{tickets.length}</span> {status === 'all' ? 'tickets' : status.replace(/_/g, ' ')}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={
              'min-h-11 rounded-md border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
              (status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/60')
            }
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto min-h-11 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground hover:border-primary/60 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <details className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground" open={useToken}>
        <summary className="cursor-pointer font-semibold text-foreground">Use an admin token instead of sign-in</summary>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-foreground">
            <input type="checkbox" checked={useToken} onChange={(e) => setUseToken(e.target.checked)} className="h-4 w-4" /> Send token header
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_SUPPORT_TOKEN (kept in this tab only)"
            autoComplete="off"
            className="min-h-11 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </details>

      {error ? <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-4">
        {tickets.map((t) => (
          <article key={t.id} className="rounded-lg border border-border bg-card p-5" aria-label={t.ticket_number}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-base font-semibold text-foreground">{t.ticket_number}</span>
              <span className={'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ' + (PRIORITY_CLASS[t.priority] ?? '')}>{t.priority}</span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{t.category.replace(/_/g, ' ')}</span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{t.status.replace(/_/g, ' ')}</span>
              <span className="ml-auto text-xs text-muted-foreground">{when(t.created_at)}</span>
            </div>
            <h2 className="mt-3 text-lg font-bold text-foreground">{t.subject}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.name ?? '—'} · <a href={`mailto:${t.email}?subject=${encodeURIComponent(`[${t.ticket_number}] ${t.subject}`)}`} className="font-semibold text-primary underline-offset-4 hover:underline">{t.email}</a>
              {t.plan_tier ? ` · ${t.plan_tier}` : ''}
              {t.clerk_user_id ? ' · signed in' : ' · anonymous'}
              {t.page_url ? (
                <>
                  {' · '}
                  <a href={t.page_url} className="underline-offset-4 hover:underline" rel="noreferrer">page</a>
                </>
              ) : null}
            </p>
            <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-foreground">{t.message}</p>

            <div className="mt-5 grid gap-4 border-t border-border pt-4 lg:grid-cols-[1fr_auto]">
              <label className="block text-sm font-semibold text-foreground">
                Internal notes
                <textarea
                  value={notes[t.id] ?? t.admin_notes ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
                  onBlur={() => {
                    const value = notes[t.id]
                    if (value !== undefined && value !== (t.admin_notes ?? '')) void patch(t.id, { admin_notes: value })
                  }}
                  className="mt-2 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Saved when you click away"
                />
              </label>
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-foreground">
                  Priority
                  <select value={t.priority} onChange={(e) => void patch(t.id, { priority: e.target.value })} className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SET_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={t.status === s}
                      onClick={() => void patch(t.id, { status: s })}
                      className={
                        'min-h-11 rounded-md border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                        (t.status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-primary/60')
                      }
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
        {!loading && !error && tickets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No {status === 'all' ? '' : status.replace(/_/g, ' ') + ' '}tickets.</p>
        ) : null}
      </div>
    </section>
  )
}
