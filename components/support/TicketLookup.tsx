'use client'

import { FormEvent, useState } from 'react'

const FIELD =
  'mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'
const LABEL = 'block text-sm font-semibold text-foreground'

const STATUS_LABEL: Record<string, string> = {
  open: 'Open — we have it',
  in_progress: 'In progress',
  waiting_on_customer: 'Waiting on you — check your email',
  resolved: 'Resolved',
  closed: 'Closed',
}

type Ticket = {
  ticket_number: string
  status: string
  category: string
  priority: string
  subject: string
  created_at: string
  updated_at: string
  resolved_at: string | null
}

function when(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(iso)) + ' ET'
  } catch {
    return iso
  }
}

export default function TicketLookup() {
  const [ticketNumber, setTicketNumber] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<Ticket | null>(null)

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setTicket(null)
    setLoading(true)
    try {
      const qs = new URLSearchParams({ ticket_number: ticketNumber.trim().toUpperCase(), email: email.trim().toLowerCase() })
      const res = await fetch(`/api/support-ticket?${qs.toString()}`, { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; ticket?: Ticket; error?: string }
      if (!res.ok || !body.ticket) throw new Error(body.error || 'No ticket matches that number and email.')
      setTicket(body.ticket)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6" aria-labelledby="lookup-title">
      <h2 id="lookup-title" className="text-lg font-bold text-foreground">Check a ticket</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">The ticket number from your confirmation email, plus the email you used.</p>
      <form onSubmit={lookup} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" noValidate>
        <label className={`${LABEL} min-w-0`}>
          Ticket number
          <input required value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} className={FIELD + ' min-w-0 font-mono uppercase'} placeholder="BD-20260906-A1B2" pattern="BD-\d{8}-[0-9A-Fa-f]{4}" autoCapitalize="characters" />
        </label>
        <label className={`${LABEL} min-w-0`}>
          Email
          <input required type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} placeholder="you@example.com" />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-semibold text-foreground hover:border-primary/60 hover:text-primary disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {loading ? 'Checking…' : 'Look up'}
        </button>
      </form>

      {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}

      {ticket ? (
        <dl className="mt-5 grid min-w-0 gap-x-6 gap-y-3 rounded-md border border-border bg-background p-4 text-base sm:grid-cols-2" aria-live="polite">
          <div>
            <dt className="text-sm text-muted-foreground">Ticket</dt>
            <dd className="break-all font-mono text-base font-semibold text-foreground">{ticket.ticket_number}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd className="text-base font-semibold text-foreground">{STATUS_LABEL[ticket.status] ?? ticket.status}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">Subject</dt>
            <dd className="text-base text-foreground">{ticket.subject}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Opened</dt>
            <dd className="text-foreground">{when(ticket.created_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{ticket.resolved_at ? 'Resolved' : 'Last update'}</dt>
            <dd className="text-foreground">{when(ticket.resolved_at ?? ticket.updated_at)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  )
}
