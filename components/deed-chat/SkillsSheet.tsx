'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, LogIn, MessageSquareText, Play, Plus, Trash2, Wand2 } from 'lucide-react'
import Link from 'next/link'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FL_COUNTIES } from '@/lib/counties'
import { countyLabel } from '@/lib/deed/context'
import { useDeedAuth } from '@/lib/deed/deedAuth'
import { SKILL_TEMPLATE, parseSkillMd } from '@/lib/skills/parse'
import { deleteSkill, loadSkills, runSkill, saveSkill, setSkillPref } from '@/lib/skills/remote'
import {
  REPAIR_SCOPES,
  SYSTEM_SKILLS,
  TOOL_NAMES,
  formatCell,
  formatValue,
  runToMarkdown,
  type SkillLibrary,
  type SkillRun,
  type SkillSummary,
  type SkillTool,
  type ToolResult,
} from '@/lib/skills/shared'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A skill to preselect: a system slug or a skill id (from the / menu or ?skill=). */
  preset: string | null
  /** Seeds the composer with the run as markdown and closes the panel. */
  onAskDeed: (prompt: string) => void
}

// Same type floor and control classes as ProjectsSheet (audit.py TYPE gate,
// scripts/control-boundary-gate.mjs reads `fieldClass + ' …'` literally).
const bodyText = 'text-base leading-6 sm:text-[15px]'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground'
const fieldClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-[15px]'
const primaryButton =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'
const quietButton =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

function skillKey(s: SkillSummary): string {
  return s.kind === 'system' ? s.slug : (s.id ?? s.slug)
}

function StatusChip({ status }: { status: ToolResult['status'] }) {
  const map = {
    ok: { label: 'From records', tone: 'border-primary/30 bg-primary/10 text-primary' },
    empty: { label: 'Nothing on record', tone: 'border-border bg-muted text-muted-foreground' },
    withheld: { label: 'Withheld', tone: 'border-border bg-secondary text-secondary-foreground' },
  } as const
  const s = map[status] ?? map.empty
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', s.tone)}>{s.label}</span>
}

function ResultCard({ result }: { result: ToolResult }) {
  const table = result.table && result.table.rows.length > 0 ? result.table : null
  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label={result.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-card-foreground">{result.title}</h3>
        <StatusChip status={result.status} />
      </div>
      {result.facts.length > 0 ? (
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {result.facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="tabular text-sm font-medium text-foreground">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                    {formatValue(f.value, f.format)}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  formatValue(f.value, f.format)
                )}
                {f.detail ? <span className="block text-xs font-normal text-muted-foreground">{f.detail}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {table ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[32rem] text-left text-xs">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="tabular px-2 py-1.5 align-top text-foreground">
                      {formatCell(cell, table.columns[j] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">{result.note}</p>
      <p className="mt-1 text-xs text-muted-foreground">Source: {result.source}</p>
    </section>
  )
}

/**
 * Skills (Claude.ai Skills parity, C4b / PARITY CP-6) as a side panel on /chat.
 *
 * Six system skills, each one live read of the county records BidDeed already
 * holds (title stack, sale record, zoning standards, appraiser sales, cost
 * catalog, auction record), plus the customer's own skills written as a
 * SKILL.md that chains those tools with their own instructions. A run shows
 * every figure with its source; "Ask Deed about this" hands the rows to the
 * chat so the answer is built on them, not on memory.
 */
export default function SkillsSheet({ open, onOpenChange, preset, onAskDeed }: Props) {
  const auth = useDeedAuth()
  const signedIn = auth.loaded && auth.signedIn
  const [library, setLibrary] = useState<SkillLibrary>({ signed_in: false, can_run: false, skills: SYSTEM_SKILLS })
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<string>(preset ?? 'lien_survival')
  const [county, setCounty] = useState('brevard')
  const [caseNumber, setCaseNumber] = useState('')
  const [scope, setScope] = useState('standard')
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<SkillRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null)
  const [authoring, setAuthoring] = useState(false)
  const [specMd, setSpecMd] = useState(SKILL_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const lib = await loadSkills()
    setLibrary(lib)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh, signedIn])

  useEffect(() => {
    if (preset) setSelected(preset)
  }, [preset])

  const skills = library.skills
  const current = useMemo(() => skills.find((s) => skillKey(s) === selected) ?? skills[0], [skills, selected])
  const needsScope = current?.tools.includes('repair_estimate' as SkillTool)
  const preview = useMemo(() => (authoring ? parseSkillMd(specMd) : null), [authoring, specMd])

  async function submitRun(e: React.FormEvent) {
    e.preventDefault()
    if (!current || running) return
    setRunning(true)
    setError(null)
    setUpgradeUrl(null)
    const r = await runSkill({
      skill: skillKey(current),
      county,
      case_number: caseNumber.trim(),
      scope: needsScope ? scope : undefined,
    })
    setRunning(false)
    if (!r.ok) {
      setError(r.error)
      setUpgradeUrl(r.upgradeUrl ?? null)
      setRun(null)
      return
    }
    setRun(r.data.run)
  }

  async function submitSkill(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const parsed = parseSkillMd(specMd)
    if (!parsed.ok) {
      setSaveError(parsed.error)
      return
    }
    setSaving(true)
    setSaveError(null)
    const r = await saveSkill(specMd)
    setSaving(false)
    if (!r.ok) {
      setSaveError(r.error)
      return
    }
    setAuthoring(false)
    setSelected(r.data.saved.id)
    await refresh()
  }

  async function toggle(s: SkillSummary, enabled: boolean) {
    if (!s.id) return
    setLibrary((lib) => ({ ...lib, skills: lib.skills.map((k) => (k.id === s.id ? { ...k, enabled } : k)) }))
    const r = await setSkillPref(s.id, { enabled })
    if (!r.ok) {
      setError(r.error)
      await refresh()
    }
  }

  async function remove(s: SkillSummary) {
    if (!s.id) return
    const r = await deleteSkill(s.id)
    if (!r.ok) {
      setError(r.error)
      return
    }
    if (selected === s.id) setSelected('lien_survival')
    await refresh()
  }

  const returnTo = `/chat${current ? `?skill=${encodeURIComponent(skillKey(current))}` : ''}#skills`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[state=closed]:duration-150 data-[state=open]:duration-150 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Wand2 className="size-4 text-primary" aria-hidden />
            Skills
          </SheetTitle>
          <SheetDescription className={bodyText}>
            Run a check on any Florida auction straight from county records. Every figure names its source.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!auth.loaded ? (
            <p className={cn(bodyText, 'text-muted-foreground')}>Loading…</p>
          ) : !signedIn ? (
            <div className="mb-4 rounded-lg border border-dashed border-border p-4">
              <p className={cn(bodyText, 'font-medium text-foreground')}>Sign in to run skills.</p>
              <p className={cn(bodyText, 'mt-1 text-muted-foreground')}>
                Skills run on Investor and above, and the ones you write are kept with your account.
              </p>
              <Link
                href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
              >
                <LogIn className="size-4" aria-hidden />
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submitRun} className="mb-4 rounded-lg border border-border bg-card p-4" aria-label="Run a skill">
              <label htmlFor="skill-select" className={labelClass}>
                Skill
              </label>
              <select id="skill-select" value={current ? skillKey(current) : ''} onChange={(e) => setSelected(e.target.value)} className={fieldClass + ' mt-1'}>
                {skills
                  .filter((s) => s.enabled || skillKey(s) === selected)
                  .map((s) => (
                    <option key={skillKey(s)} value={skillKey(s)}>
                      {s.name}
                      {s.kind === 'user' ? ' (yours)' : ''}
                    </option>
                  ))}
              </select>
              {current ? <p className="mt-1 text-sm text-muted-foreground">{current.description}</p> : null}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="skill-county" className={labelClass}>
                    County
                  </label>
                  <select id="skill-county" value={county} onChange={(e) => setCounty(e.target.value)} className={fieldClass + ' mt-1'}>
                    {FL_COUNTIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="skill-case" className={labelClass}>
                    Case number
                  </label>
                  <input
                    id="skill-case"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="e.g. 05-2024-CA-012345"
                    maxLength={60}
                    required
                    autoComplete="off"
                    className={fieldClass + ' mt-1'}
                  />
                </div>
              </div>
              {needsScope ? (
                <div className="mt-3">
                  <label htmlFor="skill-scope" className={labelClass}>
                    Repair scope
                  </label>
                  <select id="skill-scope" value={scope} onChange={(e) => setScope(e.target.value)} className={fieldClass + ' mt-1'}>
                    {REPAIR_SCOPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {loaded && !library.can_run ? (
                <p className={cn(bodyText, 'mt-3 rounded-md border border-border bg-secondary p-3 text-secondary-foreground')}>
                  Skills run on Investor and above.{' '}
                  <Link href="/subscribe?tier=investor" className="font-semibold text-primary underline-offset-4 hover:underline">
                    See the plans
                  </Link>
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="submit" disabled={running || !caseNumber.trim()} className={primaryButton}>
                  <Play className="size-4" aria-hidden />
                  {running ? 'Running…' : 'Run skill'}
                </button>
              </div>
              {error ? (
                <p role="alert" className={cn(bodyText, 'mt-3 text-destructive')}>
                  {error}{' '}
                  {upgradeUrl ? (
                    <Link href={upgradeUrl} className="font-semibold text-primary underline-offset-4 hover:underline">
                      See the plans
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </form>
          )}

          {run ? (
            <div className="mb-6 space-y-3" aria-live="polite">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={cn(bodyText, 'font-medium text-foreground')}>
                  {run.skill.name} · {run.auction.address || `case ${run.auction.case_number}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {countyLabel(run.auction.county)} County · case {run.auction.case_number}
                  {run.auction.auction_date ? ` · sale ${run.auction.auction_date}` : ''}
                </p>
              </div>
              {run.skill.instructions ? (
                <p className="rounded-md border border-border bg-secondary p-3 text-sm text-secondary-foreground">{run.skill.instructions}</p>
              ) : null}
              {run.results.map((r, i) => (
                <ResultCard key={`${r.tool}-${i}`} result={r} />
              ))}
              <button type="button" onClick={() => onAskDeed(runToMarkdown(run))} className={quietButton + ' text-primary'}>
                <MessageSquareText className="size-4" aria-hidden />
                Ask Deed about this
              </button>
            </div>
          ) : null}

          <h2 className="mb-2 text-sm font-semibold text-foreground">Library</h2>
          <ul className="space-y-2" aria-label="Skills library">
            {skills.map((s) => (
              <li key={skillKey(s)} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected(skillKey(s))}
                    className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Choose ${s.name}`}
                  >
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      {s.name}
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {s.kind === 'system' ? 'Built in' : 'Yours'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{s.description}</span>
                    {s.kind === 'user' ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">Uses {s.tools.map((t) => TOOL_NAMES[t] ?? t).join(', ')}</span>
                    ) : null}
                  </button>
                  {signedIn && s.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          onChange={(e) => void toggle(s, e.target.checked)}
                          className="size-4 accent-[hsl(var(--primary))]"
                        />
                        In / menu
                      </label>
                      {s.kind === 'user' ? (
                        <button
                          type="button"
                          onClick={() => void remove(s)}
                          className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Delete ${s.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {signedIn ? (
            authoring ? (
              <form onSubmit={submitSkill} className="mt-4 rounded-lg border border-border bg-card p-4" aria-label="Create a skill">
                <label htmlFor="skill-md" className={labelClass}>
                  SKILL.md
                </label>
                <textarea
                  id="skill-md"
                  value={specMd}
                  onChange={(e) => setSpecMd(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Tools you can use: {Object.entries(TOOL_NAMES).map(([k, v]) => `${k} (${v})`).join(', ')}.
                </p>
                {preview && preview.ok ? (
                  <p className="mt-2 text-sm text-foreground">
                    Will save <span className="font-semibold">{preview.skill.name}</span>, running {preview.skill.tools.map((t) => TOOL_NAMES[t]).join(' → ')}.
                  </p>
                ) : preview && !preview.ok ? (
                  <p className="mt-2 text-sm text-destructive">{preview.error}</p>
                ) : null}
                {saveError ? (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {saveError}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="submit" disabled={saving || !preview?.ok} className={primaryButton}>
                    {saving ? 'Saving…' : 'Save skill'}
                  </button>
                  <button type="button" onClick={() => setAuthoring(false)} className={quietButton}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setAuthoring(true)} className={quietButton + ' mt-4 w-full text-primary'}>
                <Plus className="size-4" aria-hidden />
                Create a skill
              </button>
            )
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
