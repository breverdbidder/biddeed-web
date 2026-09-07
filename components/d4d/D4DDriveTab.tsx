'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, Loader2, MapPinPlus, Mic, MicOff } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { D4D_DEFAULT_LANG, D4D_VOICE_LANGUAGES } from '@/lib/d4d/voice-grammar'
import { speak, useD4DVoice } from './useD4DVoice'
import { useD4DAsk } from './useD4DAsk'
import type { D4DRouteDetail, FieldStatus } from './types'

const LANG_STORAGE_KEY = 'bd_d4d_lang'

function initialLang(): string {
  if (typeof window === 'undefined') return D4D_DEFAULT_LANG
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY)
    if (saved) return saved
  } catch {
    /* storage unavailable — fall through to navigator.language */
  }
  return navigator.language || D4D_DEFAULT_LANG
}

interface Props {
  detail: D4DRouteDetail
  routeId: string
  onStopUpdated: () => void
}

function formatMoney(value: number | null): string {
  if (value == null) return 'not available'
  return `$${Math.round(value).toLocaleString()}`
}

const STATUS_BUTTONS: { status: FieldStatus; label: string }[] = [
  { status: 'vacant', label: 'Vacant' },
  { status: 'occupied', label: 'Occupied' },
  { status: 'uncertain', label: 'Uncertain' },
]

const VERDICT_BUTTONS: { status: FieldStatus; label: string }[] = [
  { status: 'bid', label: 'Bid' },
  { status: 'review', label: 'Review' },
  { status: 'skip', label: 'Skip' },
]

export default function D4DDriveTab({ detail, routeId, onStopUpdated }: Props) {
  const stops = detail.stops
  const [activeIndex, setActiveIndex] = useState(0)
  const [noteDraft, setNoteDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [loggingFind, setLoggingFind] = useState(false)
  const [findMessage, setFindMessage] = useState<string | null>(null)
  const [lang, setLang] = useState<string>(D4D_DEFAULT_LANG)

  useEffect(() => {
    setLang(initialLang())
  }, [])

  const setLangPersisted = useCallback((value: string) => {
    setLang(value)
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, value)
    } catch {
      /* storage unavailable — the selection still applies for this session */
    }
  }, [])

  const activeStop = stops[activeIndex] ?? null

  // patchStop/handleLogFind are memoized before `voice` exists below (voice's
  // own handlers depend on them), so they read confirmation-speech gating and
  // the active language through refs rather than closing over `voice.enabled`
  // / `lang` directly — a useCallback with a fixed dep array would otherwise
  // keep speaking (or staying silent, or speaking the wrong language) based
  // on whatever those were the first time the callback was created, never
  // seeing later toggles or language switches.
  const voiceEnabledRef = useRef(false)
  const langRef = useRef(lang)
  langRef.current = lang

  const speakStop = useCallback((index: number) => {
    if (!voiceEnabledRef.current) return
    const stop = stops[index]
    if (!stop) {
      speak('That was the last stop on this route.', langRef.current)
      return
    }
    speak(
      `Stop ${stop.seq}. ${stop.property_address ?? 'address unknown'}. ` +
        `Judgment ${formatMoney(stop.judgment_amount)}. ` +
        `SIGNAL dollar max bid ${formatMoney(stop.signal_max_bid)}.`,
      langRef.current
    )
  }, [stops])

  const patchStop = useCallback(
    async (stopId: string, body: { fieldStatus?: FieldStatus | null; note?: string | null }, confirmation: string) => {
      setSaving(true)
      try {
        const res = await fetch(apiUrl(`/api/d4d/stops/${stopId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          onStopUpdated()
          if (voiceEnabledRef.current) speak(confirmation, langRef.current)
        } else if (voiceEnabledRef.current) {
          speak('That did not go through. Try again.', langRef.current)
        }
      } catch {
        if (voiceEnabledRef.current) speak('That did not go through. Try again.', langRef.current)
      } finally {
        setSaving(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onStopUpdated]
  )

  const handleNextStop = useCallback(() => {
    setActiveIndex((prev) => {
      const next = Math.min(prev + 1, stops.length - 1)
      speakStop(next)
      return next
    })
  }, [stops.length, speakStop])

  const handleMarkStatus = useCallback(
    (status: FieldStatus) => {
      if (!activeStop) return
      patchStop(activeStop.id, { fieldStatus: status }, `Marked ${status}.`)
    },
    [activeStop, patchStop]
  )

  const handleNote = useCallback(
    (text: string) => {
      if (!activeStop) return
      patchStop(activeStop.id, { note: text }, 'Note saved.')
    },
    [activeStop, patchStop]
  )

  const handleLogFind = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setFindMessage('Location is not available on this device.')
      return
    }
    setLoggingFind(true)
    setFindMessage(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(apiUrl('/api/d4d/discoveries'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ routeId, lat: pos.coords.latitude, lng: pos.coords.longitude }),
          })
          if (res.ok) {
            setFindMessage('Find logged at your current location.')
            onStopUpdated()
            if (voiceEnabledRef.current) speak('Find logged.', langRef.current)
          } else {
            setFindMessage('Could not log this find.')
            if (voiceEnabledRef.current) speak('That did not go through. Try again.', langRef.current)
          }
        } finally {
          setLoggingFind(false)
        }
      },
      () => {
        setFindMessage('Could not get your location.')
        setLoggingFind(false)
      },
      { timeout: 8000 }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, onStopUpdated])

  const voiceHandlers = useMemo(
    () => ({ onNextStop: handleNextStop, onMarkStatus: handleMarkStatus, onNote: handleNote, onLogFind: handleLogFind }),
    [handleNextStop, handleMarkStatus, handleNote, handleLogFind]
  )

  const voice = useD4DVoice(voiceHandlers, lang)
  voiceEnabledRef.current = voice.enabled

  const askContext = useMemo(
    () => ({ lang, routeId, stopId: activeStop?.id ?? null, county: detail.route.county }),
    [lang, routeId, activeStop?.id, detail.route.county]
  )
  const ask = useD4DAsk(askContext, voiceHandlers)

  if (!activeStop) {
    return <p className="mt-6 text-sm text-muted-foreground">This route has no stops.</p>
  }

  return (
    <div className="mt-4 space-y-4 pb-24">
      <div className="rounded-xl border border-primary/40 bg-secondary px-4 py-3 text-xs leading-5 text-muted-foreground">
        <AlertTriangle className="mr-1.5 inline size-3.5 text-primary" aria-hidden />
        You are responsible for your own attention behind the wheel. Pull over before reading or typing
        anything on this screen.
      </div>

      {(voice.supported || ask.supported) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <label htmlFor="d4d-lang" className="shrink-0 text-xs font-medium text-muted-foreground">
            Voice language
          </label>
          <select
            id="d4d-lang"
            value={lang}
            onChange={(e) => setLangPersisted(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {D4D_VOICE_LANGUAGES.map((l) => (
              <option key={l.bcp47} value={l.bcp47}>
                {l.nativeLabel} ({l.label})
              </option>
            ))}
          </select>
        </div>
      )}

      {voice.supported && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            {voice.enabled ? <Mic className="size-4 text-primary" aria-hidden /> : <MicOff className="size-4 text-muted-foreground" aria-hidden />}
            Hands-free voice
            {voice.enabled && voice.listening && <span className="text-xs text-muted-foreground">(listening…)</span>}
          </div>
          <button
            type="button"
            onClick={() => voice.setEnabled(!voice.enabled)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors ${
              voice.enabled ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground'
            }`}
          >
            {voice.enabled ? 'On' : 'Off'}
          </button>
        </div>
      )}
      {voice.enabled && voice.lastHeard && <p className="text-xs text-muted-foreground">Heard: "{voice.lastHeard}"</p>}

      {ask.supported && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Mic className={`size-4 ${ask.status !== 'idle' ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
              Ask Deed
              {ask.status === 'listening' && <span className="text-xs text-muted-foreground">(listening…)</span>}
              {ask.status === 'thinking' && <span className="text-xs text-muted-foreground">(thinking…)</span>}
            </div>
            <button
              type="button"
              onClick={() => (ask.status === 'listening' ? ask.stop() : ask.start())}
              disabled={ask.status === 'thinking'}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors disabled:opacity-50 ${
                ask.status === 'listening' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground'
              }`}
            >
              {ask.status === 'listening' ? 'Stop' : ask.status === 'thinking' ? 'Thinking…' : 'Ask'}
            </button>
          </div>
          {ask.transcript && <p className="mt-2 text-xs text-muted-foreground">Heard: "{ask.transcript}"</p>}
          {ask.answer && <p className="mt-2 text-sm leading-6 text-foreground">{ask.answer}</p>}
          {ask.error && <p className="mt-2 text-xs text-destructive">{ask.error}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {activeStop.seq}
          </span>
          <span className="text-xs text-muted-foreground">
            Stop {activeIndex + 1} of {stops.length}
          </span>
        </div>
        <p className="mt-3 text-lg font-semibold text-foreground">{activeStop.property_address ?? `Case ${activeStop.case_number}`}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-muted-foreground">
          <span>Judgment {formatMoney(activeStop.judgment_amount)}</span>
          <span className="text-primary">SIGNAL$ Max Bid {formatMoney(activeStop.signal_max_bid)}</span>
        </div>
        {activeStop.field_status !== 'pending' && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-primary">Marked: {activeStop.field_status}</p>
        )}

        <div className="mt-5">
          <p className="text-xs font-medium text-muted-foreground">Occupancy</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {STATUS_BUTTONS.map((b) => (
              <button
                key={b.status}
                type="button"
                disabled={saving}
                onClick={() => handleMarkStatus(b.status)}
                className="min-h-11 min-w-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Decision</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {VERDICT_BUTTONS.map((b) => (
              <button
                key={b.status}
                type="button"
                disabled={saving}
                onClick={() => handleMarkStatus(b.status)}
                className="min-h-11 min-w-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="d4d-note">
            Note
          </label>
          <div className="mt-2 flex gap-2">
            <textarea
              id="d4d-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              placeholder="Boarded windows, overgrown lot, no vehicles…"
              className="min-h-11 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              disabled={saving || !noteDraft.trim()}
              onClick={() => {
                handleNote(noteDraft.trim())
                setNoteDraft('')
              }}
              className="min-h-11 min-w-11 shrink-0 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextStop}
          disabled={activeIndex >= stops.length - 1}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground disabled:opacity-50"
        >
          Next stop
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        onClick={handleLogFind}
        disabled={loggingFind}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {loggingFind ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MapPinPlus className="size-4" aria-hidden />}
        Log a find
      </button>
      {findMessage && <p className="text-center text-xs text-muted-foreground">{findMessage}</p>}
    </div>
  )
}
