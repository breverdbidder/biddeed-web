'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { apiUrl } from '@/lib/api'
import { readDeedStream, stripPropertiesMarker, trimForWorker, type DeedMessage } from '@/lib/deed/protocol'
import { parseD4DVoiceCommand, resolveD4DVoiceLanguage } from '@/lib/d4d/voice-grammar'
import { speak, type D4DVoiceHandlers } from './useD4DVoice'

/**
 * "Ask Deed" push-to-talk mic (issue #20104) — separate from useD4DVoice's
 * always-on hands-free command mic. A continuous recognizer that forwarded
 * every unmatched utterance to the Worker as a question would fire an LLM
 * call on every stray sentence in the car (radio, a passenger talking), so
 * that fallthrough only happens here, on a single deliberate tap.
 *
 * Grammar-first, same as the spec asks: whatever comes back from
 * SpeechRecognition is checked against lib/d4d/voice-grammar.ts before it is
 * ever sent anywhere, so "next stop" spoken into this mic still just
 * advances the stop instead of round-tripping to the model. Only a miss
 * becomes a question to POST /api/d4d/ask.
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

/**
 * Strips markdown before a reply is spoken. Deed's answers are written for a
 * screen (headers, bullet lists, bold) and speechSynthesis reads the raw
 * punctuation aloud verbatim if it isn't removed first.
 */
export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export type D4DAskStatus = 'idle' | 'listening' | 'thinking'

export interface D4DAskContext {
  lang: string
  routeId: string
  stopId: string | null
  county: string | null
}

export function useD4DAsk(context: D4DAskContext, handlers: D4DVoiceHandlers) {
  const [status, setStatus] = useState<D4DAskStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const contextRef = useRef(context)
  contextRef.current = context
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  // Post-mount, same reasoning as useD4DVoice's `supported` — avoids an SSR
  // (always false) vs. first-client-render (true in some browsers) mismatch.
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()) && 'speechSynthesis' in window)
  }, [])

  const ask = useCallback(async (question: string) => {
    const { lang, routeId, stopId, county } = contextRef.current
    setStatus('thinking')
    setAnswer('')
    setError(null)
    try {
      const wire: DeedMessage[] = trimForWorker([{ role: 'user', content: question }])
      const res = await fetch(apiUrl('/api/d4d/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: wire, county, route_id: routeId, stop_id: stopId }),
      })
      if (!res.ok || !res.body) {
        const detail = await res
          .json()
          .then((j: { error?: string }) => j.error)
          .catch(() => null)
        throw new Error(detail || `Deed returned ${res.status}`)
      }
      let acc = ''
      await readDeedStream(res.body, (delta) => {
        acc += delta
        setAnswer(stripPropertiesMarker(acc))
      })
      const finalText = stripPropertiesMarker(acc)
      setAnswer(finalText)
      setStatus('idle')
      if (finalText) speak(stripMarkdownForSpeech(finalText), lang)
    } catch (err) {
      const message = (err as Error).message || 'Could not reach Deed.'
      setError(message)
      setStatus('idle')
      speak('That did not go through. Try again.', lang)
    }
  }, [])

  const handleFinal = useCallback(
    (text: string) => {
      setTranscript(text)
      const command = parseD4DVoiceCommand(text, contextRef.current.lang)
      if (!command) {
        void ask(text)
        return
      }
      setStatus('idle')
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
    },
    [ask]
  )

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    recognitionRef.current?.stop()
    setTranscript('')
    setAnswer('')
    setError(null)

    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = resolveD4DVoiceLanguage(contextRef.current.lang).bcp47

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      if (!result) return
      const text = result[0]?.transcript ?? ''
      if (result.isFinal) {
        recognition.stop()
        handleFinal(text)
      } else {
        setTranscript(text)
      }
    }
    recognition.onerror = () => {
      setStatus('idle')
      setError('Could not hear you. Try again.')
    }
    recognition.onend = () => {
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    recognitionRef.current = recognition
    setStatus('listening')
    try {
      recognition.start()
    } catch {
      setStatus('idle')
    }
  }, [handleFinal])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { supported, status, transcript, answer, error, start, stop }
}
