'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Check,
  FolderKanban,
  Mic,
  Paperclip,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Square,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { apiUrl } from '@/lib/api'
import { ensureChatIdentity, getChatIdentity } from '@/lib/deed/chatIdentity'
import { cn } from '@/lib/utils'
import type { DeedSendOptions } from './useDeedThread'

// The live ElevenLabs voice session (WebSocket + audio worklet, ~400 lines)
// is only implemented in the Cloudflare Worker's vanilla-JS /chat page
// (src/worker.js) -- porting that real-time audio pipeline into this React
// composer is a separate, substantial piece of work (see issue #19828 spec).
// Until it's ported, this button takes the visitor to where voice already
// works end-to-end, rather than shipping a dead disabled control.
const VOICE_HREF = '/chat'

const MAX_LEN = 4000
// Matches the Worker's own MAX_UPLOAD_BYTES (src/worker.js) — checked client
// side too so a customer sees the limit before the request round-trips.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ACCEPT =
  'application/pdf,text/csv,text/plain,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'image/png,image/jpeg,image/webp,image/gif,' +
  '.pdf,.csv,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface Project {
  id: string
  name: string
  county?: string | null
}

interface PendingUpload {
  /** null while the upload is still in flight. */
  id: string | null
  filename: string
  status: 'uploading' | 'ready' | 'unsupported' | 'failed'
}

interface IdentityGate {
  reason: string
  run: () => void
}

interface Props {
  onSend: (text: string, opts?: DeedSendOptions) => void
  onStop: () => void
  streaming: boolean
  /** 'hero' is the large centred box on the empty home; 'docked' sits at the bottom of a thread. */
  variant: 'hero' | 'docked'
  /** Seeds the box (a prompt-starter chip). The customer still presses send. */
  seed?: string | null
  onSeedConsumed?: () => void
  autoFocus?: boolean
  /** The Project this thread is already scoped to, if any (issue #19847 C3). */
  projectId?: string | null
}

/**
 * The single input on the home surface — the same control whether the page is
 * a fresh start or a running thread. One box, one send key, no modes.
 *
 * Enter sends and Shift+Enter breaks a line on a hardware keyboard; on a
 * touch keyboard Enter stays a newline (the send button is the send). IME
 * composition is respected so a Japanese or Hebrew input commit is never
 * mistaken for a send.
 *
 * The "+" menu (upload, screenshot, public-records, deep research) and the
 * Project selector are parity with the Worker's own /chat composer
 * (src/worker.js buildChatPage) — same endpoints, same identity token, issue
 * #19934. Upload/screenshot/research require a chat identity token first
 * (POST /api/deed/upload and /api/deed/projects both 401 without one); the
 * inline email row below the box is this surface's equivalent of the
 * Worker's sign-in drawer, gated the same way (`requireIdentityThen`).
 */
export default function Composer({
  onSend,
  onStop,
  streaming,
  variant,
  seed,
  onSeedConsumed,
  autoFocus,
  projectId: initialProjectId = null,
}: Props) {
  const [value, setValue] = useState('')
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [publicRecords, setPublicRecords] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [identityGate, setIdentityGate] = useState<IdentityGate | null>(null)
  const [identityEmail, setIdentityEmail] = useState('')
  const [identityBusy, setIdentityBusy] = useState(false)
  const [identityError, setIdentityError] = useState<string | null>(null)

  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const hero = variant === 'hero'

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, hero ? 240 : 200)}px`
  }, [value, hero])

  useEffect(() => {
    if (!seed) return
    setValue(seed)
    onSeedConsumed?.()
    const el = ref.current
    if (!el) return
    el.focus()
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  // A reopened thread already knows its project (persisted on lib/deed/threads
  // Thread.projectId) — this syncs the composer's own selector to match it
  // rather than silently resetting to "no project" on reload.
  useEffect(() => {
    setProjectId(initialProjectId ?? null)
  }, [initialProjectId])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  function requireIdentity(run: () => void, reason: string) {
    if (getChatIdentity()) {
      run()
      return
    }
    setIdentityError(null)
    setIdentityGate({ reason, run })
  }

  async function submitIdentity(e: React.FormEvent) {
    e.preventDefault()
    if (!identityGate) return
    setIdentityBusy(true)
    setIdentityError(null)
    const identity = await ensureChatIdentity(identityEmail)
    setIdentityBusy(false)
    if (!identity) {
      setIdentityError('Could not sign in — check the address and try again.')
      return
    }
    const { run } = identityGate
    setIdentityGate(null)
    setIdentityEmail('')
    run()
  }

  function uploadFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice(`${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`)
      return
    }
    setPendingUpload({ id: null, filename: file.name, status: 'uploading' })
    const reader = new FileReader()
    reader.onerror = () => setPendingUpload({ id: null, filename: file.name, status: 'failed' })
    reader.onload = async () => {
      const identity = getChatIdentity()
      if (!identity) {
        setPendingUpload({ id: null, filename: file.name, status: 'failed' })
        return
      }
      const b64 = String(reader.result).split(',')[1] || ''
      try {
        const res = await fetch(apiUrl('/api/deed/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Chat-Token': identity.token },
          body: JSON.stringify({ filename: file.name, mime_type: file.type, data_base64: b64 }),
        })
        const data = (await res.json().catch(() => null)) as
          | { id?: string; filename?: string; extraction_status?: string; error?: string }
          | null
        if (!res.ok || !data?.id) {
          setPendingUpload({ id: null, filename: file.name, status: 'failed' })
          setNotice(data?.error || `Upload failed (${res.status}).`)
          return
        }
        setPendingUpload({
          id: data.id,
          filename: data.filename || file.name,
          status: data.extraction_status === 'ok' ? 'ready' : 'unsupported',
        })
      } catch (err) {
        setPendingUpload({ id: null, filename: file.name, status: 'failed' })
        setNotice((err as Error).message || 'Upload failed.')
      }
    }
    reader.readAsDataURL(file)
  }

  function loadProjects() {
    const identity = getChatIdentity()
    if (!identity) {
      setProjects([])
      return
    }
    setProjectsLoading(true)
    fetch(apiUrl('/api/deed/projects'), { headers: { 'X-Chat-Token': identity.token } })
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d: { projects?: Project[] }) => setProjects(d.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoading(false))
  }

  function createProject() {
    // Mirrors the Worker's own new-project prompt (src/worker.js
    // createProjectThen) — a second, richer creation form is a Next-page
    // concern (see the issue's "until the Next pages exist" scope note), not
    // this composer's.
    const name = typeof window !== 'undefined' ? window.prompt('Name this project (e.g. "Brevard tax deed — 123 Main St"):') : null
    if (!name) return
    const identity = getChatIdentity()
    if (!identity) return
    fetch(apiUrl('/api/deed/projects'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Chat-Token': identity.token },
      body: JSON.stringify({ name, source: 'home_composer' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { project?: Project } | null) => {
        if (!d?.project) return
        setProjectId(d.project.id)
        setProjects((prev) => [d.project as Project, ...(prev ?? [])])
      })
      .catch(() => setNotice('Could not create the project — try again.'))
  }

  const submit = () => {
    if (streaming) return
    const t = value.trim()
    if (!t && !pendingUpload?.id) return
    onSend(t, {
      uploadId: pendingUpload?.id ?? undefined,
      uploadLabel: pendingUpload?.filename,
      publicRecords: publicRecords || undefined,
      projectId,
    })
    setValue('')
    setPendingUpload(null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    // Coarse pointer = touch keyboard: Enter is a newline there.
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return
    e.preventDefault()
    submit()
  }

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type && item.type.startsWith('image/')) {
        const blob = item.getAsFile()
        if (!blob) continue
        e.preventDefault()
        requireIdentity(
          () => uploadFile(new File([blob], 'screenshot.png', { type: blob.type || 'image/png' })),
          'Sign in to attach a screenshot'
        )
        break
      }
    }
  }

  const activeProject = projectId ? projects?.find((p) => p.id === projectId) : null
  const canSend = (value.trim().length > 0 || Boolean(pendingUpload?.id)) && !streaming
  const menuActive = publicRecords || Boolean(projectId) || Boolean(pendingUpload)

  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-card text-card-foreground transition-shadow',
        'shadow-[0_1px_2px_rgba(31,27,22,0.06),0_8px_24px_-12px_rgba(31,27,22,0.18)]',
        'focus-within:border-primary/60 focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]',
        hero ? 'border-border' : 'border-border'
      )}
    >
      {notice ? (
        <div className="mx-3 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
          {notice}
        </div>
      ) : null}

      {pendingUpload ? (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5">
          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-xs text-secondary-foreground">
            {pendingUpload.status === 'uploading'
              ? `Uploading ${pendingUpload.filename}…`
              : pendingUpload.status === 'failed'
                ? `${pendingUpload.filename} — upload failed`
                : pendingUpload.status === 'unsupported'
                  ? `${pendingUpload.filename} — attached (no text preview for this file type)`
                  : `${pendingUpload.filename} — ready, Deed will cite it`}
          </span>
          <button
            type="button"
            onClick={() => setPendingUpload(null)}
            aria-label={`Remove ${pendingUpload.filename}`}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {identityGate ? (
        <form
          onSubmit={submitIdentity}
          className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2"
        >
          <span className="text-xs text-muted-foreground">{identityGate.reason} —</span>
          <Input
            type="email"
            required
            autoFocus
            value={identityEmail}
            onChange={(e) => setIdentityEmail(e.target.value)}
            placeholder="you@email.com"
            className="h-8 max-w-[200px] text-xs"
          />
          <Button type="submit" size="sm" disabled={identityBusy} className="h-8">
            {identityBusy ? 'Signing in…' : 'Continue'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setIdentityGate(null)
              setIdentityError(null)
            }}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Cancel
          </button>
          {identityError ? <span className="w-full text-xs text-destructive">{identityError}</span> : null}
        </form>
      ) : null}

      <label htmlFor="deed-home-input" className="sr-only">
        Ask Deed about Florida foreclosure and tax deed auctions
      </label>
      <textarea
        id="deed-home-input"
        ref={ref}
        rows={hero ? 2 : 1}
        value={value}
        maxLength={MAX_LEN}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={
          hero
            ? 'Ask about any Florida auction — a county, a case number, an address…'
            : 'Ask a follow-up…'
        }
        className={cn(
          'block w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/80',
          hero ? 'max-h-[240px] px-5 pb-2 pt-4 text-base sm:text-[17px]' : 'max-h-[200px] px-4 pb-1 pt-3 text-[15px]'
        )}
      />

      <div className={cn('flex items-center gap-1', hero ? 'px-3 pb-3' : 'px-2 pb-2')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'relative inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'
              )}
              aria-label="Add an attachment or research option"
            >
              <Plus className="size-[18px]" aria-hidden />
              {menuActive ? (
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" aria-hidden />
              ) : null}
              <span className="sr-only">Add an attachment or research option</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-72">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Documents, screenshots, and research
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                requireIdentity(() => fileRef.current?.click(), 'Sign in to upload documents')
              }
            >
              <Paperclip className="mr-2 size-4" aria-hidden />
              Upload documents
              <span className="ml-auto text-[10px] text-muted-foreground">PDF · CSV · DOCX · XLSX · images</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                requireIdentity(() => {
                  setNotice('Paste your screenshot now (Ctrl/Cmd+V) — it will attach to your next message.')
                  ref.current?.focus()
                }, 'Sign in to attach a screenshot')
              }
            >
              <ScanLine className="mr-2 size-4" aria-hidden />
              Paste screenshot
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem checked={publicRecords} onCheckedChange={(v) => setPublicRecords(Boolean(v))}>
              <Search className="mr-2 size-4" aria-hidden />
              Public-records search
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem
              onSelect={() =>
                requireIdentity(
                  () =>
                    onSend(
                      "Run deep research on the property we're discussing and tell me what a SIGNAL$ Property Report would cover.",
                      { projectId }
                    ),
                  'Sign in to run Deep Research'
                )
              }
            >
              <Sparkles className="mr-2 size-4" aria-hidden />
              Deep Research → SIGNAL$
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuSub onOpenChange={(open) => open && projects === null && loadProjects()}>
              <DropdownMenuSubTrigger>
                <FolderKanban className="mr-2 size-4" aria-hidden />
                {activeProject ? `Project: ${activeProject.name}` : 'Project: none'}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                {!getChatIdentity() ? (
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Sign in above to scope this chat to a Project.
                  </DropdownMenuLabel>
                ) : projectsLoading ? (
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Loading…</DropdownMenuLabel>
                ) : (
                  <>
                    {projectId ? (
                      <DropdownMenuItem onSelect={() => setProjectId(null)}>
                        <X className="mr-2 size-4" aria-hidden />
                        Clear project scope
                      </DropdownMenuItem>
                    ) : null}
                    {(projects ?? []).map((p) => (
                      <DropdownMenuItem key={p.id} onSelect={() => setProjectId(p.id)}>
                        {p.id === projectId ? <Check className="mr-2 size-4" aria-hidden /> : <FolderKanban className="mr-2 size-4" aria-hidden />}
                        {p.name}
                      </DropdownMenuItem>
                    ))}
                    {(projects ?? []).length === 0 ? (
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        No projects yet.
                      </DropdownMenuLabel>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => requireIdentity(createProject, 'Sign in to create a project')}>
                      <Plus className="mr-2 size-4" aria-hidden />
                      New project
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) uploadFile(file)
          }}
        />

        <a
          href={VOICE_HREF}
          title="Talk to Deed · Voice AI · 70+ languages"
          className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Mic className="size-[18px]" aria-hidden />
          <span className="sr-only">Talk to Deed — voice AI in 70+ languages</span>
        </a>

        <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">
          {hero ? 'Deed reads the live county calendars · answers cite the record' : 'Enter to send · Shift+Enter for a new line'}
        </span>

        <button
          type="button"
          onClick={streaming ? onStop : submit}
          disabled={!streaming && !canSend}
          aria-label={streaming ? 'Stop generating' : 'Send message'}
          className={cn(
            'ml-auto inline-flex size-11 items-center justify-center rounded-xl outline-none transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
            streaming
              ? 'bg-foreground text-background hover:opacity-90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground'
          )}
        >
          {streaming ? <Square className="size-3.5 fill-current" aria-hidden /> : <ArrowUp className="size-[18px]" aria-hidden />}
        </button>
      </div>
    </div>
  )
}
