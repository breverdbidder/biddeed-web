'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  FolderKanban,
  LogIn,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Square,
  X,
} from 'lucide-react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
import { apiUrl } from '@/lib/api'
import { useDeedAuth } from '@/lib/deed/deedAuth'
import { cn } from '@/lib/utils'
import type { DeedSendOptions } from './useDeedThread'
import VoiceStrip from './VoiceStrip'
import { useDeedVoice } from './useDeedVoice'

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

interface PendingUpload {
  /** null while the upload is still in flight. */
  id: string | null
  filename: string
  status: 'uploading' | 'ready' | 'unsupported' | 'failed'
}

interface SignInGate {
  reason: string
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
 * The "+" menu (upload, screenshot, public-records, deep research) is parity
 * with the Worker's own /chat composer (issue #19934). Upload, screenshot and
 * Deep Research need a verified identity (PARITY CP-3): the Clerk session,
 * never an email typed into a box. Signed out, the row under the box offers
 * the real sign-in with a return to this page — a door, not a locked wall.
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
  const [notice, setNotice] = useState<string | null>(null)
  const [signInGate, setSignInGate] = useState<SignInGate | null>(null)
  const auth = useDeedAuth()
  const signedIn = auth.loaded && auth.signedIn
  const pathname = usePathname()
  // Set after mount, so an automated visitor (tests/e2e) can tell the
  // server-rendered box from the interactive one: on the live site a click
  // that lands before hydration is a click on nothing, and that is not a
  // product defect worth a retry loop — it is a wait for this attribute.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const hero = variant === 'hero'
  // PARITY CP-2 §3: the mic in the composer IS voice — the ElevenLabs session
  // ported from the Worker's /chat page (lib/deed/voice.ts), not a link to it.
  const voice = useDeedVoice()
  const inputId = hero ? 'deed-home-input' : 'deed-thread-input'

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
    if (signedIn) {
      run()
      return
    }
    setSignInGate({ reason })
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
      const b64 = String(reader.result).split(',')[1] || ''
      try {
        // The Clerk session cookie is the identity; the route answers 401 without it.
        const res = await fetch(apiUrl('/api/deed/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  // Projects (C3) arrive with PARITY CP-4, keyed on the Clerk sub. Until
  // then the selector says so — labelled coming, never locked — and a thread
  // reopened with a project id keeps it.
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

  const canSend = (value.trim().length > 0 || Boolean(pendingUpload?.id)) && !streaming
  const menuActive = publicRecords || Boolean(projectId) || Boolean(pendingUpload)

  return (
    <div
      data-hydrated={hydrated ? 'true' : undefined}
      className={cn(
        'relative rounded-2xl border bg-card text-card-foreground transition-shadow',
        'shadow-[0_1px_2px_rgba(31,27,22,0.06),0_8px_24px_-12px_rgba(31,27,22,0.18)]',
        'focus-within:border-primary/60 focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]',
        hero ? 'border-input' : 'border-input'
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
            className="inline-flex size-11 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {signInGate ? (
        <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">{signInGate.reason} — your chats and documents stay with your account.</span>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(pathname || '/chat')}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
          >
            <LogIn className="size-4" aria-hidden />
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setSignInGate(null)}
            className="inline-flex min-h-11 items-center px-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Not now
          </button>
        </div>
      ) : null}

      <VoiceStrip
        state={voice.state}
        onStop={voice.stop}
        onSubmitGate={voice.submitGate}
        onCloseGate={voice.closeGate}
        onDismiss={voice.dismiss}
      />

      <label htmlFor={inputId} className="sr-only">
        Ask Deed about Florida foreclosure and tax deed auctions
      </label>
      <textarea
        id={inputId}
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
              className="min-h-11"
              onSelect={() =>
                requireIdentity(() => fileRef.current?.click(), 'Sign in to upload documents')
              }
            >
              <Paperclip className="mr-2 size-4" aria-hidden />
              Upload documents
              <span className="ml-auto text-xs text-muted-foreground">PDF · CSV · DOCX · XLSX · images</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11"
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
              className="min-h-11"
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
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderKanban className="mr-2 size-4" aria-hidden />
                {projectId ? 'Project: scoped' : 'Project: none'}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Saved projects are coming with the next release — one per property, with its files and this chat.
                </DropdownMenuLabel>
                {projectId ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="min-h-11" onSelect={() => setProjectId(null)}>
                      <X className="mr-2 size-4" aria-hidden />
                      Clear project scope
                    </DropdownMenuItem>
                  </>
                ) : null}
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

        <button
          type="button"
          onClick={voice.toggle}
          aria-pressed={voice.state.active}
          aria-label={voice.state.active ? 'Stop talking to Deed' : 'Talk to Deed — voice, 70+ languages'}
          title={voice.state.active ? 'Stop voice session' : 'Talk to Deed · voice · 70+ languages'}
          className={cn(
            'inline-flex size-11 items-center justify-center rounded-xl outline-none transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
            voice.state.active
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          {voice.state.active ? <MicOff className="size-[18px]" aria-hidden /> : <Mic className="size-[18px]" aria-hidden />}
        </button>

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
