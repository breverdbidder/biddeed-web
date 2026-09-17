'use client'

import { useEffect, useState } from 'react'
import { FolderKanban, FolderPlus, MessageSquareText } from 'lucide-react'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { apiUrl } from '@/lib/api'
import { getChatIdentity } from '@/lib/deed/chatIdentity'
import { countyLabel } from '@/lib/deed/context'
import { CHAT_HISTORY_CONTAINED } from '@/lib/deed/threads'
import { cn } from '@/lib/utils'

export interface ProjectDraft {
  county: string
  caseNumber: string | null
  source: string | null
  intent: string | null
}

interface Project {
  id: string
  name: string
  county?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set by the Auctions "start a project for this sale" link (#19847 S2). */
  draft: ProjectDraft | null
  /** Seeds the composer with a prompt and closes the panel. */
  onAskDeed: (prompt: string) => void
}

// Body copy in the panel sits on the audit.py TYPE floor (P/LI ≥ 16 px on a
// phone, ≥ 15 px on desktop) — the hosted run 35264942602 measured the
// sheet's 14 px paragraphs as red on /chat#projects.
const bodyText = 'text-base leading-6 sm:text-[15px]'
const itemClass =
  'flex w-full min-h-11 items-center gap-2 rounded-md px-2 text-left text-base text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring sm:text-[15px]'

/**
 * Projects (Claude.ai Projects parity, C3) as a side panel on /chat.
 *
 * Persistence is contained until the verified-owner boundary ships (issue
 * #20226 → PARITY-3), so while contained the panel says exactly that —
 * labelled "coming", never a locked wall (meta prompt CP-2 §1) — and still
 * does the one thing that works today: turning the sale the customer arrived
 * from into a first question for Deed. Once containment lifts, the same
 * panel lists the account's projects from /api/deed/projects and can create
 * one, matching the Worker drawer it replaces.
 */
export default function ProjectsSheet({ open, onOpenChange, draft, onAskDeed }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [loading, setLoading] = useState(false)
  const identity = !CHAT_HISTORY_CONTAINED ? getChatIdentity() : null

  useEffect(() => {
    if (!open || CHAT_HISTORY_CONTAINED || !identity || projects !== null) return
    setLoading(true)
    fetch(apiUrl('/api/deed/projects'), { headers: { 'X-Chat-Token': identity.token } })
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d: { projects?: Project[] }) => setProjects(d.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function createProject() {
    if (!identity) return
    const name = typeof window !== 'undefined' ? window.prompt('Name this project (e.g. "Brevard tax deed — 123 Main St"):') : null
    if (!name) return
    fetch(apiUrl('/api/deed/projects'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Chat-Token': identity.token },
      body: JSON.stringify({ name, county: draft?.county ?? undefined, case_number: draft?.caseNumber ?? undefined, source: draft?.source ?? 'chat_projects' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { project?: Project } | null) => {
        if (d?.project) setProjects((prev) => [d.project as Project, ...(prev ?? [])])
      })
      .catch(() => {
        /* the panel stays; the customer can retry */
      })
  }

  const draftPrompt = draft
    ? draft.caseNumber
      ? `I'm starting a project for case ${draft.caseNumber} in ${countyLabel(draft.county)} County. What should I check first before I bid, and what would a SIGNAL$ Property Report add?`
      : `I'm starting a project for a ${countyLabel(draft.county)} County sale. What should I check first before I bid?`
    : null

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
              {draftPrompt ? (
                <button type="button" onClick={() => onAskDeed(draftPrompt)} className={cn(itemClass, 'mt-3 border border-input bg-card font-medium text-primary')}>
                  <MessageSquareText className="size-4" aria-hidden />
                  Ask Deed about this sale
                </button>
              ) : null}
            </div>
          ) : null}

          {CHAT_HISTORY_CONTAINED || !identity ? (
            <div className="rounded-lg border border-dashed border-border p-4">
              <p className={cn(bodyText, 'font-medium text-foreground')}>Saved projects are coming with verified sign-in.</p>
              <p className={cn(bodyText, 'mt-1 text-muted-foreground')}>
                Until then, every chat with Deed works without an account. When projects land, a signed-in account keeps
                its files, notes and threads together — and nobody else can read them.
              </p>
            </div>
          ) : loading ? (
            <p className={cn(bodyText, 'text-muted-foreground')}>Loading your projects…</p>
          ) : (
            <ul className="space-y-1" aria-label="Your projects">
              {(projects ?? []).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onAskDeed(`Continue my project "${p.name}"${p.county ? ` in ${countyLabel(p.county)} County` : ''} — what is the next step?`)
                    }
                    className={itemClass}
                  >
                    <FolderKanban className="size-4 text-muted-foreground" aria-hidden />
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              ))}
              {(projects ?? []).length === 0 ? <li className={cn(bodyText, 'px-2 text-muted-foreground')}>No projects yet.</li> : null}
              <li className="pt-2">
                <button type="button" onClick={createProject} className={cn(itemClass, 'font-medium text-primary')}>
                  <FolderPlus className="size-4" aria-hidden />
                  New project
                </button>
              </li>
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
