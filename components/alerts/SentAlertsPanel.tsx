'use client'

import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { ALERT_TYPE_LABELS, healthState, type SentAlert, type WatchHealth } from '@/lib/alerts/history'

// PARITY CP-5: what the watches have sent, kept in the account (Supabase) and
// downloadable from here: every alert as CSV, every current sale date as one
// calendar file, or one alert's date. The run history a Claude.ai scheduled
// task shows, for Deed Watches.

const SHOWN = 20

const whenEt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function sentLabel(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${whenEt.format(d)} ET`
}

const STATUS_TEXT: Record<SentAlert['status'], string> = {
  sent: 'Sent',
  sending: 'Sending',
  failed: 'Not delivered',
}

const HEALTH_TEXT = {
  healthy: 'Checks are running',
  delayed: 'Checks are running late',
  failing: 'Checks have stopped',
} as const

function filenameFrom(disposition: string | null, fallback: string) {
  const m = disposition ? /filename="([^"]+)"/.exec(disposition) : null
  return m?.[1] ?? fallback
}

const linkClass = 'inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function SentAlertsPanel() {
  const [alerts, setAlerts] = useState<SentAlert[]>([])
  const [health, setHealth] = useState<WatchHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/alerts/history', { credentials: 'include', cache: 'no-store' })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Unable to load your sent alerts.')
      setAlerts(Array.isArray(body?.alerts) ? body.alerts : [])
      setHealth(body?.health && typeof body.health === 'object' ? body.health : null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your sent alerts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Downloads go through fetch so a failure (a sign-in that expired, a network
  // error) shows here as a message instead of saving an error page as a file.
  // The href stays on each link for middle-click / open-in-new-tab.
  async function download(event: MouseEvent<HTMLAnchorElement>, href: string, fallbackName: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setDownloading(href)
    setDownloadError(null)
    try {
      const response = await fetch(href, { credentials: 'include', cache: 'no-store' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(response.status === 401 ? 'Your sign-in has expired. Sign in again to download.' : body?.error || 'The download did not work. Try again.')
      }
      const url = URL.createObjectURL(await response.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = filenameFrom(response.headers.get('content-disposition'), fallbackName)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : 'The download did not work. Try again.')
    } finally {
      setDownloading(null)
    }
  }

  const state = healthState(health, new Date())
  const visible = showAll ? alerts : alerts.slice(0, SHOWN)
  const hasCalendar = alerts.some((a) => a.has_calendar)

  return (
    <section className="space-y-4" aria-labelledby="sent-alerts-title" data-testid="sent-alerts">
      <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="sent-alerts-title" className="text-lg font-bold text-foreground">Sent alerts</h2>
          <p className="mt-1 max-w-2xl text-base text-muted-foreground">Every alert your watches email you is kept here, in your account. Download the list, or add the sale dates to your calendar.</p>
          {state !== 'unknown' && health ? (
            <p role="status" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="watch-health" data-state={state}>
              <span aria-hidden="true" className={`size-2 rounded-full ${state === 'healthy' ? 'bg-primary' : state === 'failing' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
              <span className="font-semibold text-foreground">{HEALTH_TEXT[state]}</span>
              <span>Every 15 minutes{health.last_run_at ? ` · last check ${sentLabel(health.last_run_at)}` : ''}</span>
            </p>
          ) : null}
        </div>
        {alerts.length > 0 ? (
          <div className="flex flex-wrap gap-x-5 text-sm">
            <a href="/api/alerts/history?format=csv" download onClick={(e) => void download(e, '/api/alerts/history?format=csv', 'biddeed-alerts.csv')} aria-busy={downloading === '/api/alerts/history?format=csv'} className={linkClass}>Export CSV</a>
            {hasCalendar ? <a href="/api/alerts/history?format=ics" download onClick={(e) => void download(e, '/api/alerts/history?format=ics', 'biddeed-auction-dates.ics')} aria-busy={downloading === '/api/alerts/history?format=ics'} className={linkClass}>Add sale dates to calendar</a> : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Try again</button>
        </div>
      ) : null}
      {downloadError ? <div role="alert" className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{downloadError}</div> : null}
      {loading ? <div className="border border-border bg-card p-6 text-sm text-muted-foreground">Loading sent alerts…</div> : null}
      {!loading && !error && alerts.length === 0 ? (
        <div className="border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">Nothing sent yet. When a sale you watch changes, the alert we email you is listed here too, with its calendar file.</div>
      ) : null}
      {!loading && alerts.length > 0 ? (
        <ul className="divide-y divide-border border border-border bg-card">
          {visible.map((alert) => (
            <li key={alert.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-foreground">{alert.subject || `${ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}: ${alert.case_number}`}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span>{sentLabel(alert.sent_at ?? alert.created_at)}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm">
                <span className={`border px-2 py-1 text-xs font-bold uppercase tracking-wide ${alert.status === 'failed' ? 'border-destructive/40 text-destructive' : 'border-border text-muted-foreground'}`}>{STATUS_TEXT[alert.status]}</span>
                {alert.has_calendar ? (
                  <a href={`/api/alerts/history?format=ics&id=${encodeURIComponent(alert.id)}`} download onClick={(e) => void download(e, `/api/alerts/history?format=ics&id=${encodeURIComponent(alert.id)}`, `biddeed-alert-${alert.id}.ics`)} aria-busy={downloading === `/api/alerts/history?format=ics&id=${encodeURIComponent(alert.id)}`} className={linkClass} aria-label={`Calendar file for ${alert.case_number}`}>Calendar (.ics)</a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && alerts.length > SHOWN ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={linkClass}>{showAll ? 'Show fewer' : `Show all ${alerts.length}`}</button>
      ) : null}
    </section>
  )
}
