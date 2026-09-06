'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, X } from 'lucide-react'

import DeedComposer from '@/components/deed/DeedComposer'
import DeedThread from '@/components/deed/DeedThread'
import type { SlashCommand } from '@/components/deed/SlashMenu'
import { useDeedChat, type DeedAttachment } from '@/components/deed/useDeedChat'
import type { DeedAction } from '@/lib/deed/protocol'
import { cn } from '@/lib/utils'
import DeedRobotMark from '@/components/deed/DeedRobotMark'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Deed — the conversation column of the split-screen workspace.
 *
 * The workspace beside it is the SAME AuctionRadar mount the user drives with a
 * mouse. Deed does not get its own copy of the data views; it drives that one
 * through the action grammar in lib/deed/context.ts. Two ways in, one source of
 * truth on screen.
 *
 * Actions change the URL, never component state. The URL *is* the context
 * object useDeedContext() reads back, so a filter applied any other way would
 * make Deed's next answer wrong about the screen it is looking at — it would
 * describe the filter it asked for while the user sees a different one.
 */
export default function DeedPanel({ open, onClose }: Props) {
  const router = useRouter()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState<string | null>(null)

  const runAction = useCallback(
    (action: DeedAction) => {
      if (action.kind === 'filter_county') {
        // Rebuilt from the live URL rather than from remembered state: the user
        // may have changed the view or the sale type mid-answer.
        const params = new URLSearchParams(window.location.search)
        params.set('county', action.county)
        router.push(`/radar?${params.toString()}`)
        return
      }
      router.push(`/radar/${encodeURIComponent(action.auctionId)}`)
    },
    [router]
  )

  const chat = useDeedChat(runAction)
  const { context, send, status, stop, streaming, turns, reset } = chat

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const onCommand = (command: SlashCommand) => {
    if (command.name === 'clear') {
      reset()
      return
    }
    if (command.name === 'design') {
      // /design does not invent a design brief — it states what is on screen and
      // asks for a critique against the tokens this app actually ships. The
      // screen capture is offered rather than forced: getDisplayMedia needs its
      // own user gesture and a permission prompt fired from a slash command
      // reads as an ambush.
      setPending(
        [
          `Critique the ${context.surface} as a design reviewer.`,
          '',
          'Judge it against the BidDeed design system: white ground, navy headings,',
          'brand-blue as the only accent, light-blue tint surfaces, tabular figures on every',
          'currency column, WCAG 2.2 AA tap targets, and a 320px floor.',
          '',
          'Be specific about hierarchy, density and what a bidder looks at first.',
          'Attach a screen capture with the + button if you want me to look at the pixels.',
        ].join('\n')
      )
    }
  }

  const onSend = (text: string, attachments: DeedAttachment[]) => {
    setPending(null)
    send(text, attachments)
  }

  return (
    <>
      {open ? (
        <div
          // top-14, not inset-0: the h-14 sticky Topbar - including the sidebar
          // toggle - must stay reachable while Deed is open on a phone. Measured
          // live at 390x844 (#20060): a full-height backdrop/panel at z-30/z-40 sat
          // above the topbar's z-20 and ate every click on it (30 s Playwright
          // timeout on the sidebar toggle).
          className="fixed inset-x-0 top-14 bottom-0 z-30 bg-foreground/60 lg:hidden"
          aria-hidden
          onClick={onClose}
        />
      ) : null}

      <aside
        id="deed-panel"
        aria-label="Deed — BidDeed agent"
        aria-hidden={!open}
        className={cn(
          'fixed top-14 bottom-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border',
          'bg-card transition-transform duration-200 motion-reduce:transition-none',
          'lg:static lg:top-auto lg:bottom-auto lg:z-auto lg:h-auto lg:max-w-none lg:transition-[width] lg:duration-200',
          open
            ? 'translate-x-0 lg:w-[26rem] xl:w-[30rem]'
            : 'hidden pointer-events-none translate-x-full lg:flex lg:w-0 lg:overflow-hidden lg:border-l-0'
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <DeedRobotMark size={30} decorative={false} className="rounded-md" />
          <h2 className="text-sm font-semibold text-foreground">Deed</h2>
          <span className="truncate text-xs text-muted-foreground">· {context.surface}</span>

          <button
            type="button"
            onClick={reset}
            disabled={turns.length === 0}
            tabIndex={open ? 0 : -1}
            className={cn(
              'ml-auto inline-flex size-9 items-center justify-center rounded-md text-muted-foreground',
              'outline-none transition-colors hover:bg-secondary hover:text-foreground',
              'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40'
            )}
          >
            <RotateCcw className="size-4" aria-hidden />
            <span className="sr-only">Start a new thread</span>
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground',
              'outline-none transition-colors hover:bg-secondary hover:text-foreground',
              'focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close Deed panel</span>
          </button>
        </div>

        <DeedThread
          turns={turns}
          streaming={streaming}
          status={status}
          surface={context.surface}
          onSuggestion={(text) => setPending(text)}
        />

        <DeedComposer
          status={status}
          surface={context.surface}
          initialValue={pending ?? ''}
          onSend={onSend}
          onStop={stop}
          onCommand={onCommand}
        />
      </aside>
    </>
  )
}
