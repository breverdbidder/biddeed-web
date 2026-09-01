'use client'

import { FormEvent, useState } from 'react'

export default function SkipTracePanel() {
  const [subjectRef, setSubjectRef] = useState('')
  const [purpose, setPurpose] = useState('due_diligence')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setStatus(null)
    try { const response = await fetch('/api/skip-trace', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject_ref: subjectRef.trim(), purpose, consent_version: consent ? 'v1' : null, requested_fields: ['name', 'phones', 'emails'] }) }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error || 'Skip trace is not available.'); setStatus(body?.message || 'Request submitted.') } catch (cause) { setStatus(cause instanceof Error ? cause.message : 'Skip trace is not available.') } finally { setLoading(false) }
  }

  return <section className="border border-border bg-card p-5 sm:p-6" aria-labelledby="skip-trace-title"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Provider-gated</p><h2 id="skip-trace-title" className="mt-1 text-xl font-bold text-foreground">Skip trace</h2><p className="mt-1 text-sm text-muted-foreground">Prepare a compliant request without sending raw personal information from the browser.</p><form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-foreground">Opaque subject reference<input required value={subjectRef} onChange={(event) => setSubjectRef(event.target.value)} className="mt-2 min-h-11 w-full border border-input bg-background px-3 font-mono text-sm font-normal text-foreground" placeholder="auction-record-id" /></label><label className="block text-sm font-semibold text-foreground">Permissible purpose<select value={purpose} onChange={(event) => setPurpose(event.target.value)} className="mt-2 min-h-11 w-full border border-input bg-background px-3 font-normal text-foreground"><option value="due_diligence">Investment due diligence</option><option value="owner_outreach">Authorized owner outreach</option><option value="servicing">Servicing or compliance</option></select></label><label className="flex items-start gap-3 text-sm text-foreground"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-4 accent-[hsl(var(--primary))]" />I confirm that I have a documented permissible purpose and consent basis for this request.</label><button disabled={loading || !consent} className="min-h-11 w-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{loading ? 'Checking eligibility…' : 'Check provider eligibility'}</button></form>{status ? <p role="status" className="mt-4 border border-border bg-background p-3 text-sm text-foreground">{status}</p> : null}<p className="mt-5 text-xs leading-5 text-muted-foreground">Provider activation is subject to contract, entitlement, lawful-purpose, retention, deletion, and audit controls. Raw contact details are never displayed here by default.</p></section>
}
