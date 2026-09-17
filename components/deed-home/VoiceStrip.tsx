'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AudioLines, Crown, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isRtl } from '@/lib/deed/voice'
import { cn } from '@/lib/utils'
import type { DeedVoiceState } from './useDeedVoice'

interface Props {
  state: DeedVoiceState
  onStop: () => void
  onSubmitGate: (email: string) => boolean
  onCloseGate: () => void
  onDismiss: () => void
}

/**
 * The strip above the composer's textarea that carries the voice session:
 * the one-time email gate, the live status + last transcript lines while
 * Deed is listening, the error line, and the 10-minute cap panel with the
 * Investor upsell. Renders nothing while voice is idle, so the composer
 * looks exactly as before until the mic is pressed.
 *
 * Everything here is text or a Lucide icon — no pictographs in controls
 * (G-ICONS) — and every control is ≥ 44 px (G-TAP).
 */
export default function VoiceStrip({ state, onStop, onSubmitGate, onCloseGate, onDismiss }: Props) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (state.gateOpen) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (onSubmitGate(email)) {
            setEmail('')
            setError(null)
          } else {
            setError('Enter a valid email address to start the voice session.')
          }
        }}
        className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2"
      >
        <span className="text-xs text-muted-foreground">Free 10-minute voice session — your email, then talk to Deed:</span>
        <label htmlFor="deed-voice-email" className="sr-only">
          Your email address, to start the voice session
        </label>
        <Input
          id="deed-voice-email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="h-11 max-w-[200px] text-sm"
        />
        <Button type="submit" size="sm" className="h-11">
          Start talking
        </Button>
        <button
          type="button"
          onClick={onCloseGate}
          className="inline-flex min-h-11 items-center px-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Cancel
        </button>
        {error ? (
          <span role="alert" className="w-full text-xs text-destructive">
            {error}
          </span>
        ) : null}
      </form>
    )
  }

  if (state.phase === 'idle') return null

  if (state.phase === 'capped') {
    return (
      <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
        <Crown className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 text-xs text-foreground">
          {state.status} Investor members get unlimited voice time with Deed.
        </span>
        <Link
          href="/pricing"
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          See plans
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5">
        <span role="status" className="min-w-0 flex-1 text-xs text-destructive">
          {state.status}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    )
  }

  const listening = state.phase === 'listening'
  return (
    <div className="mx-3 mt-3 rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <AudioLines
          className={cn('size-4 shrink-0 text-primary', listening && 'animate-pulse motion-reduce:animate-none')}
          aria-hidden
        />
        <span role="status" aria-live="polite" className="min-w-0 flex-1 text-xs font-medium text-foreground">
          {state.status}
        </span>
        <button
          type="button"
          onClick={onStop}
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          End session
        </button>
      </div>
      {state.transcript.length > 0 ? (
        <ol className="mt-1 space-y-0.5" aria-label="Voice transcript">
          {state.transcript.map((line, i) => (
            <li key={i} dir={isRtl(line.text) ? 'rtl' : 'ltr'} className="text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">{line.who === 'user' ? 'You' : 'Deed'}:</span> {line.text}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
