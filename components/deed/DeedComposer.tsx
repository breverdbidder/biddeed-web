'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Camera,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Plus,
  ScanLine,
  Square,
  X,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ACCEPTED, MAX_FILES, captureScreen, formatBytes, toAttachments } from './attachments'
import SlashMenu, { filterCommands, type SlashCommand } from './SlashMenu'
import type { DeedAttachment, DeedStatus } from './useDeedChat'

interface Props {
  status: DeedStatus
  surface: string
  /**
   * Text to seed the box with — a suggestion chip or a slash command's
   * pre-filled prompt. Seeding rather than sending is deliberate: the user gets
   * to read and edit it first, and a /design brief in particular is worth
   * editing before it is spent.
   */
  initialValue?: string
  onSend: (text: string, attachments: DeedAttachment[]) => void
  onStop: () => void
  onCommand: (command: SlashCommand) => void
}

export default function DeedComposer({
  status,
  surface,
  initialValue = '',
  onSend,
  onStop,
  onCommand,
}: Props) {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState<DeedAttachment[]>([])
  const [notice, setNotice] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const streaming = status === 'streaming'
  // The menu opens only when '/' is the first character of the box. A slash
  // mid-sentence ("foreclosure/tax deed") is text, not a command.
  const slashOpen = value.startsWith('/') && !value.includes(' ') && !streaming
  const matches = slashOpen ? filterCommands(value) : []

  // Autosize. Reset to auto first or the box can only ever grow.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  useEffect(() => setSlashIndex(0), [value])

  // Seed from a suggestion or a slash command, then put the caret at the end so
  // the user can keep typing. Guarded on a non-empty value so clearing `pending`
  // upstream does not wipe something half-typed.
  useEffect(() => {
    if (!initialValue) return
    setValue(initialValue)
    const el = textareaRef.current
    if (!el) return
    el.focus()
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length))
  }, [initialValue])

  // Object URLs are only revoked when an attachment is actually removed, so
  // clean up whatever is still held when the composer unmounts.
  useEffect(() => {
    return () => {
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return
    setFiles((prev) => {
      const { accepted, rejected } = toAttachments(incoming, prev.length)
      setNotice(rejected)
      return [...prev, ...accepted]
    })
  }, [])

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const hit = prev.find((f) => f.id === id)
      if (hit?.previewUrl) URL.revokeObjectURL(hit.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
    setNotice([])
  }

  const submit = () => {
    if (streaming) return
    if (!value.trim() && files.length === 0) return
    onSend(value, files)
    setValue('')
    setFiles([])
    setNotice([])
  }

  const pickCommand = (c: SlashCommand) => {
    setValue('')
    onCommand(c)
    textareaRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIndex((i) => (i + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIndex((i) => (i - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pickCommand(matches[slashIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setValue('')
        return
      }
    }
    // Enter sends, Shift+Enter newlines. On a touch keyboard Enter must stay a
    // newline: a fat-thumbed send on a half-typed question about a bid is a
    // real cost, so the check is on the key event's own modifier only after
    // confirming this is not a composition (IME) commit.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const captureAndAttach = async () => {
    try {
      const shot = await captureScreen()
      if (shot) addFiles([shot])
    } catch (err) {
      setNotice([(err as Error).message])
    }
  }

  return (
    <div
      className="border-t border-slate-800 bg-[#0b1220] px-3 py-3"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      {notice.length > 0 ? (
        <ul className="mb-2 space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          {notice.map((n) => (
            <li key={n} className="text-xs text-amber-200">
              {n}
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <>
          <ul className="mb-2 flex flex-wrap gap-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex max-w-full items-center gap-2 rounded-md border border-slate-700 bg-slate-900/70 py-1 pl-2 pr-1"
              >
                {f.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.previewUrl}
                    alt=""
                    className="size-7 shrink-0 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="size-4 shrink-0 text-slate-400" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block max-w-[10rem] truncate text-xs text-slate-200">
                    {f.name}
                  </span>
                  <span className="block text-[10px] tabular text-slate-500">
                    {formatBytes(f.size)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded text-slate-400 outline-none hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-bd-orange"
                >
                  <X className="size-3.5" aria-hidden />
                  <span className="sr-only">Remove {f.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mb-2 text-[11px] leading-snug text-slate-500">
            Deed sees the file names, not the contents — attachments are passed as a list.
            Ask for the figure you need and it will answer from auction data.
          </p>
        </>
      ) : null}

      <div
        className={cn(
          'relative rounded-xl border bg-slate-900/60 transition-colors',
          dragging ? 'border-bd-orange' : 'border-slate-700'
        )}
      >
        {slashOpen ? (
          <SlashMenu
            query={value}
            activeIndex={slashIndex}
            onHover={setSlashIndex}
            onPick={pickCommand}
          />
        ) : null}

        <label htmlFor="deed-input" className="sr-only">
          Message Deed about {surface}
        </label>
        <textarea
          id="deed-input"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files)
            if (pasted.length) {
              e.preventDefault()
              addFiles(pasted)
            }
          }}
          placeholder="Ask about this screen…"
          role={slashOpen && matches.length ? 'combobox' : undefined}
          aria-expanded={slashOpen && matches.length > 0 ? true : undefined}
          aria-controls={slashOpen && matches.length ? 'deed-slash-menu' : undefined}
          aria-activedescendant={
            slashOpen && matches.length ? `deed-slash-${matches[slashIndex]?.name}` : undefined
          }
          className="block max-h-[200px] w-full resize-none bg-transparent px-3 pb-1 pt-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />

        <div className="flex items-center gap-1 px-2 pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-lg text-slate-400 outline-none transition-colors hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-bd-orange"
              >
                <Plus className="size-4" aria-hidden />
                <span className="sr-only">Add an attachment</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-64">
              <DropdownMenuLabel className="text-xs font-normal text-slate-400">
                Up to {MAX_FILES} files · images, PDF, CSV, XLSX
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                <Paperclip className="mr-2 size-4" aria-hidden />
                Attach files
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void captureAndAttach()}>
                <ScanLine className="mr-2 size-4" aria-hidden />
                Capture screen
              </DropdownMenuItem>
              <DropdownMenuItem
                className="md:hidden"
                onSelect={() => cameraRef.current?.click()}
              >
                <Camera className="mr-2 size-4" aria-hidden />
                Take a photo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                <ImageIcon className="mr-2 size-4" aria-hidden />
                Add an image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />

          {/*
            Present, and honestly disabled. The voice agent is blocked on two
            things that are not code: the CSP does not yet allow the ElevenLabs
            bundle (script-src carries no unpkg.com and no pinned hashes despite
            a comment in middleware.ts claiming otherwise), and the integration
            choice — npm SDK vs widget embed — is Ariel's call. A control that
            says why it cannot run is honest; one that silently does nothing is
            not, and hiding it would lose the affordance entirely.
          */}
          <button
            type="button"
            disabled
            title="Voice is not connected yet — the ElevenLabs bundle is still blocked by our content security policy."
            className="inline-flex size-9 cursor-not-allowed items-center justify-center rounded-lg text-slate-600"
          >
            <Mic className="size-4" aria-hidden />
            <span className="sr-only">
              Voice input — not connected yet, pending content security policy approval
            </span>
          </button>

          <span className="ml-1 hidden text-[11px] text-slate-600 sm:inline">
            Enter to send · Shift+Enter for a new line
          </span>

          <button
            type="button"
            onClick={streaming ? onStop : submit}
            disabled={!streaming && !value.trim() && files.length === 0}
            className={cn(
              'ml-auto inline-flex size-9 items-center justify-center rounded-lg outline-none',
              'transition-colors focus-visible:ring-2 focus-visible:ring-bd-orange',
              streaming
                ? 'bg-slate-700 text-white hover:bg-slate-600'
                : 'bg-bd-orange text-slate-950 hover:bg-bd-orange-300 disabled:bg-slate-800 disabled:text-slate-600'
            )}
          >
            {streaming ? (
              <Square className="size-3.5 fill-current" aria-hidden />
            ) : (
              <ArrowUp className="size-4" aria-hidden />
            )}
            <span className="sr-only">{streaming ? 'Stop generating' : 'Send message'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
