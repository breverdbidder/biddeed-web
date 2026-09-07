'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { D4D_DEFAULT_LANG, parseD4DVoiceCommand, resolveD4DVoiceLanguage, type FieldStatusWord } from '@/lib/d4d/voice-grammar'

/**
 * Hands-free Drive mode voice control — browser SpeechRecognition +
 * speechSynthesis only (issue #20100, multilingual grammar added #20104). No
 * vendor, no key, no spend, and feature-detected: callers must hide the
 * toggle entirely when `supported` is false rather than rendering a control
 * that errors on tap.
 *
 * Grammar lives in lib/d4d/voice-grammar.ts, keyed by BCP-47 language tag —
 * this hook only wires SpeechRecognition/speechSynthesis to it. Matching a
 * spoken command against a language the recognizer isn't currently listening
 * in wouldn't work anyway, since `recognition.lang` biases what the browser
 * even transcribes, so `lang` here must be the same tag the caller passes to
 * the language selector.
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
type FieldStatusForVoice = FieldStatusWord

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

// speechSynthesis.getVoices() returns [] until the browser has finished
// loading its voice list — on first call in a session that is asynchronous
// and signalled by the 'voiceschanged' event, never by the getVoices() call
// itself resolving late. Every caller needs the same wait, so it is cached
// here rather than re-implemented at each speak() call.
let voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([])
  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) return Promise.resolve(existing)
  if (voicesReadyPromise) return voicesReadyPromise
  voicesReadyPromise = new Promise((resolve) => {
    // Resolves at most once, on whichever fires first: a real voiceschanged
    // event, or the 1s fallback. The fallback resolves with getVoices()
    // AS-IS — even empty — rather than re-checking length: an engine that
    // never populates a voice list (observed here: headless Chromium with no
    // TTS voices installed) would otherwise leave this promise pending
    // forever, and every future speak() call awaiting it silently never
    // speaks. Speaking with no explicit `.voice` set still works — the
    // browser picks a default for utterance.lang — so resolving empty is a
    // safe degrade, not a further failure.
    const finish = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish)
    setTimeout(finish, 1000)
  })
  return voicesReadyPromise
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const norm = lang.toLowerCase()
  const exact = voices.find((v) => v.lang.toLowerCase() === norm)
  if (exact) return exact
  const base = norm.split('-')[0]
  return voices.find((v) => v.lang.toLowerCase().split('-')[0] === base) ?? null
}

/** Speaks `text` in `lang` (default en-US), matching a voice by BCP-47 tag when one is installed. */
export function speak(text: string, lang: string = D4D_DEFAULT_LANG) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.02
  utterance.lang = lang
  loadVoices().then((voices) => {
    const voice = pickVoice(voices, lang)
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
  })
}

export function useD4DVoice(handlers: D4DVoiceHandlers, lang: string = D4D_DEFAULT_LANG) {
  const [enabled, setEnabled] = useState(false)
  const [listening, setListening] = useState(false)
  const [lastHeard, setLastHeard] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const langRef = useRef(lang)
  langRef.current = lang

  // Computed post-mount, not during the initial render: SpeechRecognition
  // exists in some browsers before permission is granted, so this differs
  // between the server (always false) and a real browser's first render —
  // computing it inline would hydrate mismatched and force a full client
  // re-render of everything gated on it, including the language selector.
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(voiceSupported())
  }, [])

  const handleCommand = useCallback((transcript: string) => {
    setLastHeard(transcript)
    const command = parseD4DVoiceCommand(transcript, langRef.current)
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
    recognition.lang = resolveD4DVoiceLanguage(lang).bcp47

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
    // Switching `lang` while listening restarts recognition on the new
    // locale — a driver who changes the selector mid-route should not have
    // to also toggle the mic off and on for it to take effect.
  }, [enabled, supported, handleCommand, lang])

  return { supported, enabled, setEnabled, listening, lastHeard }
}
