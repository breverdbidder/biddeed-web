'use client'

import { FolderKanban, MessageSquareText } from 'lucide-react'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { countyLabel } from '@/lib/deed/context'
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
 * Saved projects land with PARITY CP-4, keyed on the Clerk sub like threads
 * are since CP-3 — the Worker's email-keyed project rows (issue #20226) are
 * not read from here. Until CP-4 the panel says so, labelled "coming" and
 * never a locked wall (meta prompt CP-2 §1), and still does the one thing
 * that works today: turning the sale the customer arrived from into a first
 * question for Deed.
 */
export default function ProjectsSheet({ open, onOpenChange, draft, onAskDeed }: Props) {
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

          <div className="rounded-lg border border-dashed border-border p-4">
            <p className={cn(bodyText, 'font-medium text-foreground')}>Saved projects are coming with the next release.</p>
            <p className={cn(bodyText, 'mt-1 text-muted-foreground')}>
              One project per property, with its files, notes and this chat — kept with your account, so nobody else can
              read them. Until then, every chat with Deed already saves to your account when you are signed in.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
