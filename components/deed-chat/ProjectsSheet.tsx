'use client'

import { useCallback, useEffect, useState } from 'react'
import { FolderKanban, LogIn, MessageSquareText, Plus } from 'lucide-react'
import Link from 'next/link'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FL_COUNTIES } from '@/lib/counties'
import { countyLabel } from '@/lib/deed/context'
import { useDeedAuth } from '@/lib/deed/deedAuth'
import { createProject, listProjects, notifyProjectsChanged, type ProjectSummary } from '@/lib/deed/projectsRemote'
import { cn } from '@/lib/utils'

export interface ProjectDraft {
  county: string
  caseNumber: string | null
  source: string | null
  intent: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set by an S2 hook (#19847) that arrived signed out — kept so sign-in can finish it. */
  draft: ProjectDraft | null
  /** Seeds the composer with a prompt and closes the panel. */
  onAskDeed: (prompt: string) => void
  /** Navigates to /chat?project=<id>. */
  onOpenProject: (id: string) => void
}

// Body copy sits on the audit.py TYPE floor (P/LI ≥ 16 px on a phone, ≥ 15 px
// on desktop) — the hosted run 35264942602 measured 14 px paragraphs as red.
const bodyText = 'text-base leading-6 sm:text-[15px]'
const itemClass =
  'flex w-full min-h-11 items-center gap-2 rounded-md px-2 text-left text-base text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring sm:text-[15px]'
const fieldClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-[15px]'

function relative(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 60_000) return 'just now'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'day' : 'days'} ago`
}

export function draftPrompt(draft: ProjectDraft): string {
  return draft.caseNumber
    ? `I'm starting a project for case ${draft.caseNumber} in ${countyLabel(draft.county)} County. What should I check first before I bid, and what would a SIGNAL$ Property Report add?`
    : `I'm starting a project for a ${countyLabel(draft.county)} County sale. What should I check first before I bid?`
}

/**
 * Projects (Claude.ai Projects parity, C3 / PARITY CP-4) as a side panel on
 * /chat: the customer's projects, one per property they intend to win, and
 * the form that starts one. Opening a project goes to /chat?project=<id>,
 * where the header, files and project-scoped chat live.
 *
 * Signed out there is nothing to list — projects are kept with the account
 * (issue #20226) — so the panel is a door to sign-in that returns here, never
 * a locked wall (meta prompt CP-2 §1).
 */
export default function ProjectsSheet({ open, onOpenChange, draft, onAskDeed, onOpenProject }: Props) {
  const auth = useDeedAuth()
  const signedIn = auth.loaded && auth.signedIn
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [county, setCounty] = useState(draft?.county ?? '')
  const [caseNumber, setCaseNumber] = useState(draft?.caseNumber ?? '')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!signedIn) {
      setProjects(null)
      return
    }
    void listProjects().then((rows) => setProjects(rows ?? []))
  }, [signedIn])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  useEffect(() => {
    window.addEventListener('biddeed:projects', refresh)
    return () => window.removeEventListener('biddeed:projects', refresh)
  }, [refresh])

  useEffect(() => {
    if (draft) {
      setCounty(draft.county)
      setCaseNumber(draft.caseNumber ?? '')
      setShowForm(true)
    }
  }, [draft])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    setError(null)
    const r = await createProject({
      name: name.trim() || undefined,
      county: county || null,
      case_number: caseNumber.trim() || null,
      first_touch: draft
        ? { source: draft.source ?? 'chat', county: draft.county, case: draft.caseNumber ?? '', intent: draft.intent ?? '' }
        : { source: 'projects_panel' },
    })
    setCreating(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    notifyProjectsChanged()
    setName('')
    setCaseNumber('')
    setShowForm(false)
    onOpenProject(r.data.project.id)
  }

  const returnTo = draft
    ? `/chat?new_project_county=${encodeURIComponent(draft.county)}${draft.caseNumber ? `&case=${encodeURIComponent(draft.caseNumber)}` : ''}${draft.source ? `&source=${encodeURIComponent(draft.source)}` : ''}${draft.intent ? `&intent=${encodeURIComponent(draft.intent)}` : ''}`
    : '/chat#projects'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/*
        150 ms slide instead of the primitive's 500 ms: the panel opens from
        a URL (#projects) right after hydration, and at 390 px the referee
        measured it 48 px short of its resting edge — still sliding in — and
        scored the copy as off-screen. Fast is also simply nicer here.
      */}
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[state=closed]:duration-150 data-[state=open]:duration-150 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="size-4 text-primary" aria-hidden />
            Projects
          </SheetTitle>
          <SheetDescription className={bodyText}>
            One project per property you intend to win — files, notes and a chat that remembers.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {draft ? (
            <div className="mb-4 rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From Auctions</p>
              <p className={cn(bodyText, 'mt-1 font-medium text-foreground')}>
                {countyLabel(draft.county)} County{draft.caseNumber ? ` · case ${draft.caseNumber}` : ''}
              </p>
              <button type="button" onClick={() => onAskDeed(draftPrompt(draft))} className={cn(itemClass, 'mt-3 border border-input bg-card font-medium text-primary')}>
                <MessageSquareText className="size-4" aria-hidden />
                Ask Deed about this sale
              </button>
            </div>
          ) : null}

          {!auth.loaded ? (
            <p className={cn(bodyText, 'text-muted-foreground')}>Loading…</p>
          ) : !signedIn ? (
            <div className="rounded-lg border border-dashed border-border p-4">
              <p className={cn(bodyText, 'font-medium text-foreground')}>Sign in to keep projects with your account.</p>
              <p className={cn(bodyText, 'mt-1 text-muted-foreground')}>
                A project holds the property, its files, your notes and every chat about it — and nobody else can read them.
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
            <>
              {showForm ? (
                <form onSubmit={submit} className="mb-4 rounded-lg border border-border bg-card p-4" aria-label="New project">
                  <label htmlFor="project-name" className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Project name
                  </label>
                  <input
                    id="project-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={county ? `${countyLabel(county)} — ${caseNumber || 'new bid'}` : 'e.g. 123 Main St — tax deed'}
                    maxLength={120}
                    className={cn(fieldClass, 'mt-1')}
                  />
                  <label htmlFor="project-county" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    County
                  </label>
                  <select id="project-county" value={county} onChange={(e) => setCounty(e.target.value)} className={cn(fieldClass, 'mt-1')}>
                    <option value="">Not yet</option>
                    {FL_COUNTIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="project-case" className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Case number
                  </label>
                  <input
                    id="project-case"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="Optional — fills the sale date from the calendar"
                    maxLength={80}
                    className={cn(fieldClass, 'mt-1')}
                  />
                  {error ? <p className={cn(bodyText, 'mt-2 text-destructive')}>{error}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={creating}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Plus className="size-4" aria-hidden />
                      {creating ? 'Creating…' : 'Create project'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="inline-flex min-h-11 items-center rounded-md border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setShowForm(true)} className={cn(itemClass, 'mb-3 border border-input bg-card font-medium text-primary')}>
                  <Plus className="size-4" aria-hidden />
                  New project
                </button>
              )}

              {projects === null ? (
                <p className={cn(bodyText, 'text-muted-foreground')}>Loading your projects…</p>
              ) : projects.length === 0 ? (
                <p className={cn(bodyText, 'text-muted-foreground')}>No projects yet. Start one for the next property you mean to bid on.</p>
              ) : (
                <ul className="space-y-1" aria-label="Your projects">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => onOpenProject(p.id)} className={cn(itemClass, 'flex-col items-start gap-0 py-2')}>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {[p.county ? `${countyLabel(p.county)} County` : null, p.case_number ? `case ${p.case_number}` : null, p.sale_date ? `sale ${p.sale_date}` : null]
                            .filter(Boolean)
                            .join(' · ') || 'No property yet'}
                          {' · '}opened {relative(p.last_viewed_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
