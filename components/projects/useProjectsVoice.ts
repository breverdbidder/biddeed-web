'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { voiceSupported, speak } from '@/components/d4d/useD4DVoice'
import {
  PROJECTS_DEFAULT_LANG,
  parseProjectsVoiceCommand,
  resolveProjectsVoiceLanguage,
} from '@/lib/projects/voice-grammar'

/**
 * Hands-free "add a line" / "budget total" mic on /projects (issue #20106).
 * Same browser SpeechRecognition/speechSynthesis path as D4D's drive mode —
 * no vendor, no key, no spend (`voiceSupported`/`speak` are reused directly
 * from components/d4d/useD4DVoice.ts rather than reimplemented). Only the
 * recognition wiring below is Projects-specific, since it listens for a
 * different, much smaller grammar (lib/projects/voice-grammar.ts).
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

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface ProjectsVoiceHandlers {
  onTotal: () => void
  onAddLine: () => void
}

export function useProjectsVoice(handlers: ProjectsVoiceHandlers, lang: string = PROJECTS_DEFAULT_LANG) {
  const [enabled, setEnabled] = useState(false)
  const [listening, setListening] = useState(false)
  const [lastHeard, setLastHeard] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  // Computed post-mount so server and first client render agree (see
  // useD4DVoice.ts for why this cannot be computed inline).
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(voiceSupported())
  }, [])

  const handleCommand = useCallback(
    (transcript: string) => {
      setLastHeard(transcript)
      const command = parseProjectsVoiceCommand(transcript, lang)
      if (!command) return
      if (command.type === 'total') handlersRef.current.onTotal()
      if (command.type === 'add') handlersRef.current.onAddLine()
    },
    [lang]
  )

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
    recognition.lang = resolveProjectsVoiceLanguage(lang).bcp47

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      if (result?.isFinal) handleCommand(result[0].transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => {
      setListening(false)
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
  }, [enabled, supported, handleCommand, lang])

  return { supported, enabled, setEnabled, listening, lastHeard, speak: (text: string) => speak(text, lang) }
}
