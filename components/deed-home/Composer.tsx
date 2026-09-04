'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Mic, Square } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Props {
  onSend: (text: string) => void
  onStop: () => void
  streaming: boolean
  /** 'hero' is the large centred box on the empty home; 'docked' sits at the bottom of a thread. */
  variant: 'hero' | 'docked'
  /** Seeds the box (a prompt-starter chip). The customer still presses send. */
  seed?: string | null
  onSeedConsumed?: () => void
  autoFocus?: boolean
}

const MAX_LEN = 4000

/**
 * The single input on the home surface — the same control whether the page is
 * a fresh start or a running thread. One box, one send key, no modes.
 *
 * Enter sends and Shift+Enter breaks a line on a hardware keyboard; on a
 * touch keyboard Enter stays a newline (the send button is the send). IME
 * composition is respected so a Japanese or Hebrew input commit is never
 * mistaken for a send.
 */
export default function Composer({
  onSend,
  onStop,
  streaming,
  variant,
  seed,
  onSeedConsumed,
  autoFocus,
}: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
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

  const submit = () => {
    if (streaming) return
    const t = value.trim()
    if (!t) return
    onSend(t)
    setValue('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    // Coarse pointer = touch keyboard: Enter is a newline there.
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return
    e.preventDefault()
    submit()
  }

  const canSend = value.trim().length > 0 && !streaming

  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-card text-card-foreground transition-shadow',
        'shadow-[0_1px_2px_rgba(31,27,22,0.06),0_8px_24px_-12px_rgba(31,27,22,0.18)]',
        'focus-within:border-primary/60 focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]',
        hero ? 'border-border' : 'border-border'
      )}
    >
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
        <button
          type="button"
          disabled
          title="Voice is coming — it is not connected on this page yet."
          className="inline-flex size-11 cursor-not-allowed items-center justify-center rounded-xl text-muted-foreground/50"
        >
          <Mic className="size-[18px]" aria-hidden />
          <span className="sr-only">Voice input — not available yet</span>
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
