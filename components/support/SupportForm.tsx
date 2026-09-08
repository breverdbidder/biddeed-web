'use client'

import { FormEvent, useState } from 'react'

/** Labels are customer-facing canon: "SIGNAL$ Property Report", never "S5". */
const CATEGORIES: { value: string; label: string }[] = [
  { value: 'auction_data', label: 'Auction or tax deed data' },
  { value: 'signal_report', label: 'SIGNAL$ Property Report' },
  { value: 'billing', label: 'Billing & subscription' },
  { value: 'account', label: 'Account & sign-in' },
  { value: 'zoning', label: 'Zoning & parcel intelligence' },
  { value: 'bug', label: 'Something is broken' },
  { value: 'feature', label: 'Feature request' },
  { value: 'security', label: 'Security concern' },
  { value: 'other', label: 'Something else' },
]

const PLANS: { value: string; label: string }[] = [
  { value: '', label: 'Not sure / no account yet' },
  { value: 'free', label: 'Free' },
  { value: 'investor', label: 'Investor' },
  { value: 'pro', label: 'Pro' },
  { value: 'proplus', label: 'Pro Plus' },
  { value: 'enterprise', label: 'Enterprise' },
]

const FIELD =
  'mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'
const LABEL = 'block text-sm font-semibold text-foreground'

type Draft = {
  name: string
  email: string
  category: string
  plan_tier: string
  subject: string
  message: string
}

const EMPTY: Draft = { name: '', email: '', category: 'auction_data', plan_tier: '', subject: '', message: '' }

export default function SupportForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<string[]>([])
  const [result, setResult] = useState<{ ticket_number: string; email: string } | null>(null)

  const set = (key: keyof Draft) => (event: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: event.target.value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInvalid([])
    setSubmitting(true)
    try {
      const res = await fetch('/api/support-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          plan_tier: draft.plan_tier || null,
          page_url: typeof window !== 'undefined' ? window.location.href : null,
          company_website: honeypot, // honeypot — stays empty for humans
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        ticket_number?: string
        error?: string
        invalid?: string[]
      }
      if (!res.ok || !body.ok || !body.ticket_number) {
        setInvalid(body.invalid ?? [])
        throw new Error(body.error || 'Could not submit the ticket. Email hello@biddeed.ai and we will pick it up.')
      }
      setResult({ ticket_number: body.ticket_number, email: draft.email.trim().toLowerCase() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Email hello@biddeed.ai.')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div role="status" className="rounded-lg border border-primary/30 bg-secondary p-6 sm:p-8" aria-live="polite">
        <p className="text-base font-bold uppercase tracking-[0.16em] text-primary">Ticket received</p>
        <h2 className="font-display mt-2 text-2xl font-medium text-foreground">
          Your ticket number is{' '}
          <code className="rounded-md bg-background px-2 py-1 font-mono text-xl font-semibold tracking-wide text-foreground">
            {result.ticket_number}
          </code>
        </h2>
        <p className="mt-4 text-base leading-7 text-foreground">
          A confirmation is on its way to <strong>{result.email}</strong>. Replies come to that address. Keep the
          ticket number — you can check status below with it and this email.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/chat"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Ask Deed while you wait
          </a>
          <button
            type="button"
            onClick={() => {
              setResult(null)
              setDraft((d) => ({ ...d, subject: '', message: '' }))
            }}
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open another ticket
          </button>
        </div>
      </div>
    )
  }

  const bad = (field: string) => (invalid.includes(field) ? ' border-destructive' : '')

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-6" aria-labelledby="ticket-form-title" noValidate>
      <div>
        <h2 id="ticket-form-title" className="text-lg font-bold text-foreground">Open a ticket</h2>
        <p className="mt-1 text-base leading-7 text-muted-foreground">
          County, case number, parcel ID, the report you bought — whatever helps us reproduce it.
        </p>
      </div>

      {/* Honeypot: hidden from people and screen readers; bots fill it. */}
      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Company website
          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={LABEL}>
          Name
          <input required autoComplete="name" value={draft.name} onChange={set('name')} className={FIELD + bad('name')} placeholder="Your name" maxLength={120} />
        </label>
        <label className={LABEL}>
          Email
          <input required type="email" autoComplete="email" inputMode="email" value={draft.email} onChange={set('email')} className={FIELD + bad('email')} placeholder="you@example.com" maxLength={254} />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={LABEL}>
          Topic
          <select required value={draft.category} onChange={set('category')} className={FIELD + bad('category')}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Plan <span className="font-normal text-muted-foreground">(optional)</span>
          <select value={draft.plan_tier} onChange={set('plan_tier')} className={FIELD}>
            {PLANS.map((p) => (
              <option key={p.value || 'none'} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className={LABEL}>
        Subject
        <input required value={draft.subject} onChange={set('subject')} className={FIELD + bad('subject')} placeholder="One line — what happened?" maxLength={200} />
      </label>

      <label className={LABEL}>
        Details
        <textarea
          required
          value={draft.message}
          onChange={set('message')}
          className={FIELD + ' min-h-40 resize-y py-3 leading-7' + bad('message')}
          placeholder="Brevard tax deed, case 250104, the report shows Judgment Amount: Pending…"
          maxLength={10000}
          minLength={10}
        />
      </label>

      {error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-base leading-7 text-destructive">{error}</div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {submitting ? 'Sending…' : 'Submit ticket'}
        </button>
        <p className="text-base leading-7 text-muted-foreground">
          We only use your email to answer this request. See our{' '}
          <a href="/privacy" className="inline-flex items-center py-3.5 font-semibold text-primary underline-offset-4 hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </form>
  )
}
