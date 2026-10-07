'use client'

import { Check, FolderKanban, Paperclip, Plus, ScanLine, Search, Sparkles, Wand2, X } from 'lucide-react'

import Link from '@/components/ui/link'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ProjectSummary } from '@/lib/deed/projectsRemote'
import ComposerPlusButton from './ComposerPlusButton'

export interface ComposerPlusMenuProps {
  defaultOpen?: boolean
  menuActive: boolean
  publicRecords: boolean
  onPublicRecordsChange: (value: boolean) => void
  onUpload: () => void
  onPasteScreenshot: () => void
  onDeepResearch: () => void
  /** Absent where the composer has no skills surface. */
  onSkills?: () => void
  projectId: string | null
  activeProjectName: string | null
  signedIn: boolean
  projects: ProjectSummary[] | null
  onProjectsOpen: () => void
  onSelectProject: (id: string | null) => void
}

/**
 * The composer's "+" menu: documents, screenshot, public-records search, Deep
 * Research, skills and project scope. Loaded on first use (Composer renders
 * ComposerPlusButton until then): Radix's menu, popper and focus code was
 * ~30 KiB compressed that the landing page downloaded and initialised for a
 * menu that is closed on every page load (PageSpeed pass 3, 2026-10-07).
 */
export default function ComposerPlusMenu({
  defaultOpen = false,
  menuActive,
  publicRecords,
  onPublicRecordsChange,
  onUpload,
  onPasteScreenshot,
  onDeepResearch,
  onSkills,
  projectId,
  activeProjectName,
  signedIn,
  projects,
  onProjectsOpen,
  onSelectProject,
}: ComposerPlusMenuProps) {
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <ComposerPlusButton menuActive={menuActive} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Documents, screenshots, and research
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11"
          onSelect={onUpload}
        >
          <Paperclip className="mr-2 size-4" aria-hidden />
          Upload documents
          <span className="ml-auto text-xs text-muted-foreground">PDF · CSV · DOCX · XLSX · images</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11"
          onSelect={onPasteScreenshot}
        >
          <ScanLine className="mr-2 size-4" aria-hidden />
          Paste screenshot
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked={publicRecords} onCheckedChange={(v) => onPublicRecordsChange(Boolean(v))}>
          <Search className="mr-2 size-4" aria-hidden />
          Public-records search
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem
          className="min-h-11"
          onSelect={onDeepResearch}
        >
          <Sparkles className="mr-2 size-4" aria-hidden />
          Deep Research → SIGNAL$
        </DropdownMenuItem>
        {onSkills ? (
          <DropdownMenuItem className="min-h-11" onSelect={onSkills}>
            <Wand2 className="mr-2 size-4" aria-hidden />
            Skills
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuSub onOpenChange={(open) => open && onProjectsOpen()}>
          <DropdownMenuSubTrigger>
            <FolderKanban className="mr-2 size-4" aria-hidden />
            {projectId ? `Project: ${activeProjectName ?? 'scoped'}` : 'Project: none'}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            {!signedIn ? (
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Sign in to keep projects — one per property, with its files and this chat.
              </DropdownMenuLabel>
            ) : projects === null ? (
              <div role="status" aria-busy="true" className="space-y-2 px-2 py-2">
                <span className="sr-only">Loading your projects…</span>
                <Skeleton className="h-3 w-40" aria-hidden="true" />
                <Skeleton className="h-3 w-28" aria-hidden="true" />
              </div>
            ) : (
              <>
                {projects.length === 0 ? (
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">No projects yet.</DropdownMenuLabel>
                ) : null}
                {projects.slice(0, 12).map((p) => (
                  <DropdownMenuItem className="min-h-11" key={p.id} onSelect={() => onSelectProject(p.id)}>
                    {p.id === projectId ? <Check className="mr-2 size-4" aria-hidden /> : <FolderKanban className="mr-2 size-4" aria-hidden />}
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="min-h-11" asChild>
                  <Link href="/chat#projects">
                    <Plus className="mr-2 size-4" aria-hidden />
                    New project
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            {projectId ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="min-h-11" onSelect={() => onSelectProject(null)}>
                  <X className="mr-2 size-4" aria-hidden />
                  Clear project scope
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
