'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hands-free Drive mode voice control — browser SpeechRecognition +
 * speechSynthesis only (issue #20100). No vendor, no key, no spend, and
 * feature-detected: callers must hide the toggle entirely when `supported`
 * is false rather than rendering a control that errors on tap.
 *
 * Grammar (issue #20100 spec): "next stop", "mark vacant" / "mark occupied"
 * (generalised here to mark <vacant|occupied|uncertain> — the Drive tab
 * exposes all three as buttons, and the voice grammar would otherwise be
 * unable to reach the third), "bid" / "review" / "skip", "note <text>",
 * "log a find".
 */

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

export type VoiceStatus = FieldStatusForVoice
type FieldStatusForVoice = 'vacant' | 'occupied' | 'uncertain' | 'bid' | 'review' | 'skip'

export interface D4DVoiceHandlers {
  onNextStop: () => void
  onMarkStatus: (status: FieldStatusForVoice) => void
  onNote: (text: string) => void
  onLogFind: () => void
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function voiceSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(getRecognitionCtor()) && 'speechSynthesis' in window
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.02
  window.speechSynthesis.speak(utterance)
}

const STATUS_WORDS = new Set<FieldStatusForVoice>(['vacant', 'occupied', 'uncertain', 'bid', 'review', 'skip'])

function parseCommand(transcript: string): { type: 'next' } | { type: 'status'; status: FieldStatusForVoice } | { type: 'note'; text: string } | { type: 'find' } | null {
  const t = transcript.trim().toLowerCase().replace(/[.!?]+$/, '')
  if (t === 'next stop' || t === 'next') return { type: 'next' }
  if (t === 'log a find' || t === 'log find') return { type: 'find' }
  const markMatch = t.match(/^mark (\w+)$/)
  if (markMatch && STATUS_WORDS.has(markMatch[1] as FieldStatusForVoice)) return { type: 'status', status: markMatch[1] as FieldStatusForVoice }
  if (STATUS_WORDS.has(t as FieldStatusForVoice)) return { type: 'status', status: t as FieldStatusForVoice }
  const noteMatch = t.match(/^note (.+)$/)
  if (noteMatch) return { type: 'note', text: noteMatch[1] }
  return null
}

export function useD4DVoice(handlers: D4DVoiceHandlers) {
  const [enabled, setEnabled] = useState(false)
  const [listening, setListening] = useState(false)
  const [lastHeard, setLastHeard] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const supported = voiceSupported()

  const handleCommand = useCallback((transcript: string) => {
    setLastHeard(transcript)
    const command = parseCommand(transcript)
    if (!command) return
    switch (command.type) {
      case 'next':
        handlersRef.current.onNextStop()
        break
      case 'status':
        handlersRef.current.onMarkStatus(command.status)
        break
      case 'note':
        handlersRef.current.onNote(command.text)
        break
      case 'find':
        handlersRef.current.onLogFind()
        break
    }
  }, [])

  useEffect(() => {
    if (!enabled || !supported) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setListening(false)
      return
    }

    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      if (result?.isFinal) handleCommand(result[0].transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => {
      setListening(false)
      // Browsers auto-stop SpeechRecognition after silence; restart while
      // the driver has left the toggle on.
      if (enabled) {
        try {
          recognition.start()
          setListening(true)
        } catch {
          /* recognition already stopping — the effect cleanup will retry */
        }
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }

    return () => {
      recognition.onend = null
      recognition.stop()
    }
  }, [enabled, supported, handleCommand])

  return { supported, enabled, setEnabled, listening, lastHeard }
}
