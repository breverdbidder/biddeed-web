'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { apiUrl } from '@/lib/api'
import { DeedVoiceSession, type VoicePhase, type VoiceTranscriptLine } from '@/lib/deed/voice'

/**
 * Voice state for the composer's mic button (PARITY CP-2 §3: "the mic in the
 * composer *is* voice"). One session per composer; unmounting the composer
 * ends the call and releases the microphone.
 *
 * The email gate mirrors the Worker's `voice-email-gate`: the first voice
 * session on a device asks for an email once and records it as a lead
 * (source `voice_gate`) through this app's same-origin proxy to the Worker's
 * /chat/lead — the lead capture is the revenue reason the gate exists (meta
 * prompt 0.6), so it is kept, not dropped. The address is remembered in
 * localStorage (try/catch; a blocked store just asks again next time).
 */

const VOICE_EMAIL_KEY = 'bd_voice_email'
const MAX_TRANSCRIPT = 6

export interface DeedVoiceState {
  phase: VoicePhase
  status: string
  transcript: VoiceTranscriptLine[]
  /** true when the mic button should read as "on" (aria-pressed). */
  active: boolean
  /** true while the inline email row is showing. */
  gateOpen: boolean
}

function readVoiceEmail(): string | null {
  try {
    return localStorage.getItem(VOICE_EMAIL_KEY)
  } catch {
    return null
  }
}

function writeVoiceEmail(email: string) {
  try {
    localStorage.setItem(VOICE_EMAIL_KEY, email)
  } catch {
    /* storage unavailable — the gate simply shows again next session */
  }
}

export function isValidEmail(e: string): boolean {
  if (!e || e.includes(' ')) return false
  const at = e.indexOf('@')
  if (at < 1 || e.indexOf('@', at + 1) !== -1) return false
  const domain = e.slice(at + 1)
  const dot = domain.indexOf('.')
  return dot > 0 && dot < domain.length - 1
}

export function useDeedVoice() {
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [status, setStatus] = useState('')
  const [transcript, setTranscript] = useState<VoiceTranscriptLine[]>([])
  const [gateOpen, setGateOpen] = useState(false)
  const sessionRef = useRef<DeedVoiceSession | null>(null)

  const session = useCallback(() => {
    if (!sessionRef.current) {
      sessionRef.current = new DeedVoiceSession(
        {
          onPhase: (p, s) => {
            setPhase(p)
            setStatus(s)
            if (p === 'listening') setTranscript([])
          },
          onTranscript: (line) => setTranscript((prev) => [...prev, line].slice(-MAX_TRANSCRIPT)),
        },
        apiUrl('/api/deed/voice')
      )
    }
    return sessionRef.current
  }, [])

  useEffect(() => {
    return () => {
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    setGateOpen(false)
    void session().start()
  }, [session])

  const stop = useCallback(() => {
    session().stop()
    setPhase('idle')
    setStatus('')
  }, [session])

  /** Mic button handler: stop if live, otherwise gate once, then start. */
  const toggle = useCallback(() => {
    const s = session()
    if (s.isActive || phase === 'requesting-mic' || phase === 'connecting') {
      stop()
      return
    }
    if (phase === 'capped') return
    if (readVoiceEmail()) {
      start()
      return
    }
    setGateOpen((v) => !v)
  }, [phase, session, start, stop])

  /** Inline gate submit: record the lead, remember the address, start talking. */
  const submitGate = useCallback(
    (email: string): boolean => {
      const trimmed = email.trim().toLowerCase()
      if (!isValidEmail(trimmed)) return false
      writeVoiceEmail(trimmed)
      void fetch(apiUrl('/api/deed/lead'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'voice_gate' }),
      }).catch(() => {
        /* lead capture is best-effort; the session still starts */
      })
      start()
      return true
    },
    [start]
  )

  const closeGate = useCallback(() => setGateOpen(false), [])
  const dismiss = useCallback(() => {
    setPhase('idle')
    setStatus('')
    setTranscript([])
  }, [])

  const active = phase === 'requesting-mic' || phase === 'connecting' || phase === 'listening'

  return {
    state: { phase, status, transcript, active, gateOpen } as DeedVoiceState,
    toggle,
    stop,
    submitGate,
    closeGate,
    dismiss,
  }
}
