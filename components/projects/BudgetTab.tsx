'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Mic, MicOff, Plus, Search, Trash2 } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { PROJECTS_DEFAULT_LANG, PROJECTS_VOICE_LANGUAGES } from '@/lib/projects/voice-grammar'
import { useProjectsVoice } from './useProjectsVoice'
import type { CmBudgetDetail, CmBudgetLine, CmBudgetSummary, CmCatalogItem, CmTemplate } from './types'

const LANG_STORAGE_KEY = 'bd_projects_lang'
const TEMPLATES: { value: CmTemplate; label: string; hint: string }[] = [
  { value: 'cosmetic', label: 'Cosmetic', hint: '12 lines — paint, flooring, fixtures' },
  { value: 'standard', label: 'Standard', hint: '25 lines — kitchen, baths, systems' },
  { value: 'gut', label: 'Gut', hint: '34 lines — full rehab, structural to finish' },
]

interface Props {
  budgets: CmBudgetSummary[]
  budgetsLoading: boolean
  budgetsError: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  detail: CmBudgetDetail | null
  detailLoading: boolean
  detailError: string | null
  onCreated: (id: string) => void
  onRefreshDetail: () => void
}

function formatMoney(value: number | null): string {
  if (value == null) return '—'
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function initialLang(): string {
  if (typeof window === 'undefined') return PROJECTS_DEFAULT_LANG
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY)
    if (saved) return saved
  } catch {
    /* storage unavailable — fall through to navigator.language */
  }
  return navigator.language || PROJECTS_DEFAULT_LANG
}

export default function BudgetTab({
  budgets,
  budgetsLoading,
  budgetsError,
  selectedId,
  onSelect,
  detail,
  detailLoading,
  detailError,
  onCreated,
  onRefreshDetail,
}: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<CmTemplate>('standard')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [arv, setArv] = useState('')
  const [sqft, setSqft] = useState('')
  const [contingencyPct, setContingencyPct] = useState('10')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [addCategory, setAddCategory] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addUnit, setAddUnit] = useState('ls')
  const [addQty, setAddQty] = useState('1')
  const [addMaterial, setAddMaterial] = useState('0')
  const [addLabor, setAddLabor] = useState('0')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const addDescRef = useRef<HTMLInputElement>(null)

  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogResults, setCatalogResults] = useState<CmCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)

  const [lang, setLang] = useState<string>(PROJECTS_DEFAULT_LANG)
  useEffect(() => setLang(initialLang()), [])
  const setLangPersisted = useCallback((value: string) => {
    setLang(value)
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, value)
    } catch {
      /* storage unavailable — the selection still applies for this session */
    }
  }, [])

  const detailRef = useRef(detail)
  detailRef.current = detail

  const handleVoiceTotal = useCallback(() => {
    const b = detailRef.current?.budget
    voiceRef.current?.speak(
      b
        ? `Budget total ${formatMoney(b.budget_total)}. Actual ${formatMoney(b.actual_total)}. Variance ${formatMoney(b.variance)}.`
        : 'No budget is open.'
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleVoiceAdd = useCallback(() => {
    setShowAdd(true)
    requestAnimationFrame(() => addDescRef.current?.focus())
  }, [])

  const voiceHandlers = useMemo(() => ({ onTotal: handleVoiceTotal, onAddLine: handleVoiceAdd }), [handleVoiceTotal, handleVoiceAdd])
  const voice = useProjectsVoice(voiceHandlers, lang)
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  useEffect(() => {
    if (!showAdd || !catalogQuery.trim()) {
      setCatalogResults([])
      return
    }
    setCatalogLoading(true)
    const handle = setTimeout(() => {
      fetch(apiUrl(`/api/projects/catalog?q=${encodeURIComponent(catalogQuery.trim())}`))
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((json: { items: CmCatalogItem[] }) => setCatalogResults(json.items))
        .catch(() => setCatalogResults([]))
        .finally(() => setCatalogLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [catalogQuery, showAdd])

  const pickCatalogItem = (item: CmCatalogItem) => {
    setAddCategory(item.category)
    setAddDescription(item.description)
    setAddUnit(item.unit)
    setAddMaterial(String(item.material_unit_cost))
    setAddLabor(String(item.labor_unit_cost))
    setCatalogQuery('')
    setCatalogResults([])
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch(apiUrl('/api/projects/budgets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          purchasePrice: purchasePrice ? Number(purchasePrice) : null,
          arv: arv ? Number(arv) : null,
          sqft: sqft ? Number(sqft) : null,
          contingencyPct: contingencyPct ? Number(contingencyPct) : 10,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreateError(json.error || `Could not create this budget (${res.status}).`)
        return
      }
      const budgetId = json.budgetId as string
      await fetch(apiUrl(`/api/projects/budgets/${budgetId}/seed`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, sqft: sqft ? Number(sqft) : null }),
      }).catch(() => null)
      setName('')
      setPurchasePrice('')
      setArv('')
      setSqft('')
      setShowCreate(false)
      onCreated(budgetId)
    } catch {
      setCreateError('Could not create this budget. Check your connection and try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleAddLine = async () => {
    if (!selectedId || !addCategory.trim() || !addDescription.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch(apiUrl('/api/projects/lines'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetId: selectedId,
          category: addCategory.trim(),
          description: addDescription.trim(),
          qty: Number(addQty) || 1,
          unit: addUnit.trim() || 'ls',
          materialUnitCost: Number(addMaterial) || 0,
          laborUnitCost: Number(addLabor) || 0,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAddError(json.error || `Could not add this line (${res.status}).`)
        return
      }
      setAddCategory('')
      setAddDescription('')
      setAddUnit('ls')
      setAddQty('1')
      setAddMaterial('0')
      setAddLabor('0')
      setShowAdd(false)
      onRefreshDetail()
    } catch {
      setAddError('Could not add this line. Check your connection and try again.')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteLine = async (lineId: string) => {
    await fetch(apiUrl(`/api/projects/lines/${lineId}`), { method: 'DELETE' }).catch(() => null)
    onRefreshDetail()
  }

  const handleSaveLine = async (line: CmBudgetLine, patch: Partial<Pick<CmBudgetLine, 'description' | 'qty' | 'material_unit_cost' | 'labor_unit_cost'>>) => {
    if (!selectedId) return
    await fetch(apiUrl('/api/projects/lines'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        budgetId: selectedId,
        lineId: line.id,
        category: line.category,
        description: patch.description ?? line.description,
        qty: patch.qty ?? line.qty,
        unit: line.unit,
        materialUnitCost: patch.material_unit_cost ?? line.material_unit_cost,
        laborUnitCost: patch.labor_unit_cost ?? line.labor_unit_cost,
        trade: line.trade,
        sortOrder: line.sort_order,
        catalogItemId: line.catalog_item_id,
      }),
    }).catch(() => null)
    onRefreshDetail()
  }

  const linesByCategory = useMemo(() => {
    if (!detail) return []
    const order = detail.by_category.map((c) => c.category)
    const groups = new Map<string, CmBudgetLine[]>()
    for (const line of detail.lines) {
      const list = groups.get(line.category) ?? []
      list.push(line)
      groups.set(line.category, list)
    }
    return order.map((category) => ({ category, lines: groups.get(category) ?? [] }))
  }, [detail])

  return (
    <div className="mt-4 space-y-6">
      {/* Budget picker */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Budget</span>
          <select
            value={selectedId ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            disabled={budgetsLoading || !budgets.length}
            className="min-h-11 min-w-72 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {!budgets.length && <option value="">No budgets yet</option>}
            {budgets.map((b) => (
              <option key={b.budget_id} value={b.budget_id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:border-primary/60 hover:text-primary"
        >
          <Plus className="size-4" aria-hidden />
          New budget
        </button>
        {budgetsError && <p className="text-sm text-destructive">{budgetsError}</p>}
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
              <span className="text-xs font-medium text-muted-foreground">Budget name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rehab budget — 5400 Pina Vista Dr"
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Purchase price</span>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">ARV</span>
              <input
                type="number"
                value={arv}
                onChange={(e) => setArv(e.target.value)}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Square feet</span>
              <input
                type="number"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Contingency %</span>
              <input
                type="number"
                value={contingencyPct}
                onChange={(e) => setContingencyPct(e.target.value)}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground">Template</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTemplate(t.value)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    template === t.value ? 'border-primary bg-secondary text-foreground' : 'border-input bg-background text-muted-foreground hover:border-primary/60'
                  }`}
                >
                  <span className="block font-semibold text-foreground">{t.label}</span>
                  <span className="block text-xs">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {createError && <p className="mt-3 text-sm text-destructive">{createError}</p>}

          <button
            type="button"
            disabled={creating || !name.trim()}
            onClick={handleCreate}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Create budget
          </button>
        </div>
      )}

      {voice.supported && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <select
            value={lang}
            onChange={(e) => setLangPersisted(e.target.value)}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {PROJECTS_VOICE_LANGUAGES.map((l) => (
              <option key={l.bcp47} value={l.bcp47}>
                {l.nativeLabel} ({l.label})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-sm text-foreground">
            {voice.enabled ? <Mic className="size-4 text-primary" aria-hidden /> : <MicOff className="size-4 text-muted-foreground" aria-hidden />}
            "Add a line" or "budget total"
            {voice.enabled && voice.listening && <span className="text-xs text-muted-foreground">(listening…)</span>}
          </div>
          <button
            type="button"
            onClick={() => voice.setEnabled(!voice.enabled)}
            className={`ml-auto inline-flex min-h-11 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors ${
              voice.enabled ? 'bg-primary text-primary-foreground' : 'border border-input bg-background text-foreground'
            }`}
          >
            {voice.enabled ? 'On' : 'Off'}
          </button>
        </div>
      )}

      {detailError && <p className="text-sm text-destructive">{detailError}</p>}
      {detailLoading && !detail && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading budget…
        </div>
      )}

      {detail && (
        <>
          {/* Rollup bar */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-secondary p-5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Subtotal', detail.budget.budget_subtotal],
              [`Contingency ${detail.budget.contingency_pct}%`, detail.budget.contingency_amount],
              ['Total', detail.budget.budget_total],
              ['Actual', detail.budget.actual_total],
              ['Variance', detail.budget.variance],
              ['Projected profit', detail.budget.projected_gross_profit],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-display mt-1 font-mono text-lg font-medium tabular-nums text-foreground">{formatMoney(value as number | null)}</dd>
              </div>
            ))}
          </div>

          {/* Add line */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:border-primary/60 hover:text-primary"
            >
              <Plus className="size-4" aria-hidden />
              Add line
            </button>

            {showAdd && (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs font-medium text-muted-foreground">Search the cost catalog (editable defaults)</span>
                    <div className="flex items-center gap-2">
                      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <input
                        type="text"
                        value={catalogQuery}
                        onChange={(e) => setCatalogQuery(e.target.value)}
                        placeholder="tile, roofing, cabinets…"
                        className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      {catalogLoading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
                    </div>
                  </label>
                  {catalogResults.length > 0 && (
                    <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card">
                      {catalogResults.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => pickCatalogItem(item)}
                            className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-secondary"
                          >
                            <span className="text-foreground">{item.description}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.category} · {formatMoney(item.material_unit_cost + item.labor_unit_cost)}/{item.unit}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <input
                    type="text"
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    placeholder="Category"
                    className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 lg:col-span-2"
                  />
                  <input
                    ref={addDescRef}
                    type="text"
                    value={addDescription}
                    onChange={(e) => setAddDescription(e.target.value)}
                    placeholder="Description"
                    className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 lg:col-span-2"
                  />
                  <input
                    type="text"
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    placeholder="Unit"
                    className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="number"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    placeholder="Qty"
                    className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="number"
                    value={addMaterial}
                    onChange={(e) => setAddMaterial(e.target.value)}
                    placeholder="Material $/unit"
                    className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="number"
                    value={addLabor}
                    onChange={(e) => setAddLabor(e.target.value)}
                    placeholder="Labor $/unit"
                    className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {addError && <p className="text-sm text-destructive">{addError}</p>}

                <button
                  type="button"
                  disabled={adding || !addCategory.trim() || !addDescription.trim()}
                  onClick={handleAddLine}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {adding && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Save line
                </button>
              </div>
            )}
          </div>

          {/* Line grid grouped by category */}
          <div className="space-y-5">
            {linesByCategory.map((group) => (
              <div key={group.category}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.category}</p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium">Qty</th>
                        <th className="px-3 py-2 font-medium">Unit</th>
                        <th className="px-3 py-2 font-medium">Material $</th>
                        <th className="px-3 py-2 font-medium">Labor $</th>
                        <th className="px-3 py-2 text-right font-medium">Line total</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.lines.map((line) => (
                        <LineRow key={line.id} line={line} onSave={handleSaveLine} onDelete={handleDeleteLine} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {!linesByCategory.length && <p className="text-sm text-muted-foreground">No lines yet — add one above.</p>}
          </div>
        </>
      )}
    </div>
  )
}

function LineRow({
  line,
  onSave,
  onDelete,
}: {
  line: CmBudgetLine
  onSave: (line: CmBudgetLine, patch: Partial<Pick<CmBudgetLine, 'description' | 'qty' | 'material_unit_cost' | 'labor_unit_cost'>>) => void
  onDelete: (lineId: string) => void
}) {
  const [description, setDescription] = useState(line.description)
  const [qty, setQty] = useState(String(line.qty))
  const [material, setMaterial] = useState(String(line.material_unit_cost))
  const [labor, setLabor] = useState(String(line.labor_unit_cost))

  useEffect(() => setDescription(line.description), [line.description])
  useEffect(() => setQty(String(line.qty)), [line.qty])
  useEffect(() => setMaterial(String(line.material_unit_cost)), [line.material_unit_cost])
  useEffect(() => setLabor(String(line.labor_unit_cost)), [line.labor_unit_cost])

  const commit = () => {
    const nextQty = Number(qty)
    const nextMaterial = Number(material)
    const nextLabor = Number(labor)
    if (
      description.trim() === line.description &&
      nextQty === line.qty &&
      nextMaterial === line.material_unit_cost &&
      nextLabor === line.labor_unit_cost
    ) {
      return
    }
    onSave(line, {
      description: description.trim() || line.description,
      qty: Number.isFinite(nextQty) ? nextQty : line.qty,
      material_unit_cost: Number.isFinite(nextMaterial) ? nextMaterial : line.material_unit_cost,
      labor_unit_cost: Number.isFinite(nextLabor) ? nextLabor : line.labor_unit_cost,
    })
  }

  return (
    <tr>
      <td className="px-3 py-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commit}
          className="min-h-9 w-full min-w-[220px] rounded-md border border-input bg-transparent px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={commit}
          className="min-h-9 w-20 rounded-md border border-input bg-transparent px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </td>
      <td className="px-3 py-2 text-muted-foreground">{line.unit}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          onBlur={commit}
          className="min-h-9 w-24 rounded-md border border-input bg-transparent px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={labor}
          onChange={(e) => setLabor(e.target.value)}
          onBlur={commit}
          className="min-h-9 w-24 rounded-md border border-input bg-transparent px-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </td>
      <td className="px-3 py-2 text-right font-mono text-foreground">{formatMoney(line.line_total)}</td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => onDelete(line.id)}
          aria-label={`Delete ${line.description}`}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </td>
    </tr>
  )
}
