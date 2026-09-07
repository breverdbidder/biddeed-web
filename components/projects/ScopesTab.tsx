'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Loader2, Plus, Printer } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import type { CmBudgetDetail, CmScopeDetail } from './types'

interface Props {
  detail: CmBudgetDetail | null
  detailLoading: boolean
  onRefreshDetail: () => void
}

function formatMoney(value: number | null): string {
  if (value == null) return '—'
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ScopesTab({ detail, detailLoading, onRefreshDetail }: Props) {
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [contractorEmail, setContractorEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [openScopeId, setOpenScopeId] = useState<string | null>(null)
  const [scopeDetail, setScopeDetail] = useState<CmScopeDetail | null>(null)
  const [scopeLoading, setScopeLoading] = useState(false)
  const [bidAmount, setBidAmount] = useState('')
  const [bidStatus, setBidStatus] = useState('bid_received')
  const [savingBid, setSavingBid] = useState(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const loadScope = async (id: string) => {
    setOpenScopeId(id)
    setScopeLoading(true)
    try {
      const res = await fetch(apiUrl(`/api/projects/scopes/${id}`))
      if (!res.ok) throw new Error(`scope request failed (${res.status})`)
      const json = (await res.json()) as CmScopeDetail
      setScopeDetail(json)
      setBidAmount(json.scope.bid_amount != null ? String(json.scope.bid_amount) : '')
      setBidStatus(json.scope.status)
    } catch {
      setScopeDetail(null)
    } finally {
      setScopeLoading(false)
    }
  }

  useEffect(() => {
    // A budget switch invalidates whichever scope was open — a scope from
    // budget A rendered next to budget B's line list would misreport delta.
    setOpenScopeId(null)
    setScopeDetail(null)
    setSelectedLines(new Set())
  }, [detail?.budget.budget_id])

  const toggleLine = (id: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedBudgetedTotal = useMemo(() => {
    if (!detail) return 0
    return detail.lines.filter((l) => selectedLines.has(l.id)).reduce((sum, l) => sum + l.line_total, 0)
  }, [detail, selectedLines])

  const handleCreateScope = async () => {
    if (!detail || !name.trim() || !selectedLines.size) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch(apiUrl('/api/projects/scopes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetId: detail.budget.budget_id,
          name: name.trim(),
          lineIds: Array.from(selectedLines),
          contractorName: contractorName.trim() || null,
          contractorEmail: contractorEmail.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreateError(json.error || `Could not create this scope (${res.status}).`)
        return
      }
      setName('')
      setContractorName('')
      setContractorEmail('')
      setSelectedLines(new Set())
      onRefreshDetail()
      loadScope(json.scopeId as string)
    } catch {
      setCreateError('Could not create this scope. Check your connection and try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveBid = async () => {
    if (!openScopeId) return
    setSavingBid(true)
    try {
      const res = await fetch(apiUrl(`/api/projects/scopes/${openScopeId}/bid`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidAmount: bidAmount ? Number(bidAmount) : null, status: bidStatus }),
      })
      if (res.ok) {
        onRefreshDetail()
        loadScope(openScopeId)
      }
    } finally {
      setSavingBid(false)
    }
  }

  const handleCopy = async () => {
    if (!scopeDetail) return
    const lines = scopeDetail.lines
      .map((l) => `- ${l.description} (${l.category}) — ${l.qty} ${l.unit} — budgeted ${formatMoney(l.budgeted)}`)
      .join('\n')
    const text = `${scopeDetail.scope.name}\n\n${lines}\n\nBudgeted total: ${formatMoney(scopeDetail.budgeted_total)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage('Copied — paste it into an email or text to the contractor.')
    } catch {
      setCopyMessage('Could not copy — select and copy the list manually.')
    }
  }

  if (!detail) {
    return <p className="mt-6 text-sm text-muted-foreground">{detailLoading ? 'Loading budget…' : 'Open a budget on the Budget tab first.'}</p>
  }

  const delta = scopeDetail && scopeDetail.scope.bid_amount != null ? scopeDetail.scope.bid_amount - scopeDetail.budgeted_total : null

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <p className="text-sm font-semibold text-foreground">Existing scopes</p>
        {!detail.scopes.length && <p className="mt-2 text-sm text-muted-foreground">No scopes yet — build one from the lines on the right.</p>}
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
          {detail.scopes.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => loadScope(s.id)}
                className={`flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-secondary ${openScopeId === s.id ? 'bg-secondary' : ''}`}
              >
                <span>
                  <span className="block font-medium text-foreground">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.contractor_name ?? 'No contractor set'} · {s.status.replace('_', ' ')}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.bid_amount != null ? formatMoney(s.bid_amount) : '—'}</span>
              </button>
            </li>
          ))}
        </ul>

        {scopeLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading scope…
          </div>
        )}

        {scopeDetail && !scopeLoading && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{scopeDetail.scope.name}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-primary/60"
                >
                  <Copy className="size-3.5" aria-hidden />
                  Copy for contractor
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-primary/60"
                >
                  <Printer className="size-3.5" aria-hidden />
                  Print
                </button>
              </div>
            </div>
            {copyMessage && <p className="mt-2 text-xs text-muted-foreground">{copyMessage}</p>}

            <ul className="mt-3 divide-y divide-border">
              {scopeDetail.lines.map((l) => (
                <li key={l.scope_line_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block text-foreground">{l.description}</span>
                    <span className="block text-xs text-muted-foreground">
                      {l.category} · {l.qty} {l.unit}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatMoney(l.budgeted)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-border bg-secondary p-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Budgeted</dt>
                <dd className="font-mono text-sm font-semibold text-foreground">{formatMoney(scopeDetail.budgeted_total)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Bid</dt>
                <dd className="font-mono text-sm font-semibold text-foreground">{scopeDetail.scope.bid_amount != null ? formatMoney(scopeDetail.scope.bid_amount) : 'Not received'}</dd>
              </div>
              {delta != null && (
                <div>
                  <dt className="text-xs text-muted-foreground">{delta > 0 ? 'Over budget' : 'Under budget'}</dt>
                  <dd className={`font-mono text-sm font-semibold ${delta > 0 ? 'text-destructive' : 'text-primary'}`}>{formatMoney(Math.abs(delta))}</dd>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Bid received</span>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="min-h-11 w-40 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <select
                  value={bidStatus}
                  onChange={(e) => setBidStatus(e.target.value)}
                  className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {['draft', 'sent', 'bid_received', 'awarded', 'declined'].map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={savingBid}
                onClick={handleSaveBid}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {savingBid && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Save bid
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">Build a scope</p>
        <p className="text-xs text-muted-foreground">Pick lines from the current budget to send to a contractor.</p>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          <ul className="divide-y divide-border">
            {detail.lines.map((line) => (
              <li key={line.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={selectedLines.has(line.id)}
                    onChange={() => toggleLine(line.id)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">{line.description}</span>
                    <span className="block text-xs text-muted-foreground">{line.category}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatMoney(line.line_total)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs font-medium text-foreground">{selectedLines.size} line(s) selected — budgeted {formatMoney(selectedBudgetedTotal)}</p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Scope name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Roof + exterior envelope"
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Contractor name</span>
          <input
            type="text"
            value={contractorName}
            onChange={(e) => setContractorName(e.target.value)}
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Contractor email</span>
          <input
            type="email"
            value={contractorEmail}
            onChange={(e) => setContractorEmail(e.target.value)}
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {createError && <p className="text-sm text-destructive">{createError}</p>}

        <button
          type="button"
          disabled={creating || !name.trim() || !selectedLines.size}
          onClick={handleCreateScope}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Create scope
        </button>
      </div>
    </div>
  )
}
