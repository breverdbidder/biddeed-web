'use client'

import { useCallback, useRef, useState } from 'react'

import { apiUrl } from '@/lib/api'
import { contextPreamble, useDeedContext, type DeedContext } from '@/lib/deed/context'
import {
  extractAction,
  readDeedStream,
  trimForWorker,
  type DeedAction,
  type DeedMessage,
} from '@/lib/deed/protocol'
import { useAuctionCounts } from '@/components/shell/useAuctionCounts'

export interface DeedAttachment {
  id: string
  name: string
  size: number
  type: string
  /** Object URL for image previews. Revoked on removal. */
  previewUrl?: string
}

export interface DeedTurn {
  id: string
  role: 'user' | 'assistant'
  /** What the thread shows. Never the context preamble, never a directive. */
  content: string
  attachments?: DeedAttachment[]
  /** Set on the assistant turn that carried an action, for the "did that" line. */
  action?: DeedAction | null
  error?: string
}

export type DeedStatus = 'idle' | 'streaming' | 'error'

let seq = 0
const nextId = () => `t${++seq}`

/**
 * Describes attachments to the model in words.
 *
 * The Worker's /chat/api contract is `{ messages: [{role, content}] }` — text
 * only, and this build does not get to change it. So an attachment cannot be
 * sent for the model to read, and pretending otherwise would produce confident
 * answers about a document nobody opened. Instead the message states plainly
 * what was attached, and the composer tells the user, before they send, that
 * contents are not read yet. Routing image turns to a vision model is a
 * spend decision that belongs to Ariel (see the Deed meta-prompt, §2b).
 */
function attachmentManifest(files: DeedAttachment[]): string {
  if (files.length === 0) return ''
  const lines = files.map((f) => `- ${f.name} (${f.type || 'unknown type'}, ${f.size} bytes)`)
  return [
    '',
    'ATTACHMENTS the user added to this message. You CANNOT read their contents —',
    'this surface passes filenames only. Acknowledge them and ask for the specific',
    'figure you need, or answer from the auction data you do have. Never describe',
    'what an attachment contains.',
    ...lines,
  ].join('\n')
}

export interface UseDeedChat {
  turns: DeedTurn[]
  status: DeedStatus
  streaming: string
  send: (text: string, attachments?: DeedAttachment[]) => void
  stop: () => void
  reset: () => void
  context: DeedContext
}

export function useDeedChat(onAction: (a: DeedAction) => void): UseDeedChat {
  const [turns, setTurns] = useState<DeedTurn[]>([])
  const [status, setStatus] = useState<DeedStatus>('idle')
  const [streaming, setStreaming] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const context = useDeedContext()
  const counts = useAuctionCounts()

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const reset = useCallback(() => {
    stop()
    setTurns([])
    setStreaming('')
    setStatus('idle')
  }, [stop])

  const send = useCallback(
    (text: string, attachments: DeedAttachment[] = []) => {
      const trimmed = text.trim()
      if (!trimmed && attachments.length === 0) return
      if (status === 'streaming') return

      const userTurn: DeedTurn = {
        id: nextId(),
        role: 'user',
        content: trimmed,
        attachments: attachments.length ? attachments : undefined,
      }

      // Wire history is built from the turns as they existed BEFORE this send,
      // plus this one. Reading it out of the state setter avoids the stale
      // closure that would otherwise drop the previous answer from context.
      setTurns((prev) => {
        const history: DeedMessage[] = prev.map((t) => ({ role: t.role, content: t.content }))

        // The preamble rides on the newest user message rather than as its own
        // turn: the Worker caps the conversation at 20 messages and 8000 chars,
        // and a per-turn context block would burn both budgets while going
        // stale the moment the user changes a filter.
        const wire = trimForWorker([
          ...history,
          {
            role: 'user',
            content: [
              contextPreamble(context, counts),
              '',
              trimmed || '(no message text)',
              attachmentManifest(attachments),
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ])

        void run(wire)
        return [...prev, userTurn]
      })

      async function run(wire: DeedMessage[]) {
        setStatus('streaming')
        setStreaming('')
        const controller = new AbortController()
        abortRef.current = controller
        let acc = ''

        try {
          const res = await fetch(apiUrl('/api/deed'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: wire,
              county: context.county,
              hook: context.view || 'radar',
            }),
            signal: controller.signal,
          })

          if (!res.ok || !res.body) {
            const detail = await res
              .json()
              .then((j: { error?: string }) => j.error)
              .catch(() => null)
            throw new Error(detail || `Deed returned ${res.status}`)
          }

          await readDeedStream(res.body, (delta) => {
            acc += delta
            // Strip directives from the LIVE view too, not just the final text.
            // Mid-stream a partial "[[ACTION:filter_" is not yet matchable, so
            // the visible tail is clipped at the first '[[' instead.
            const cut = acc.indexOf('[[ACTION')
            setStreaming(cut === -1 ? acc : acc.slice(0, cut))
          })

          const { action, display } = extractAction(acc)
          setTurns((prev) => [
            ...prev,
            { id: nextId(), role: 'assistant', content: display, action: action ?? null },
          ])
          setStreaming('')
          setStatus('idle')
          if (action) onAction(action)
        } catch (err) {
          const aborted = (err as Error)?.name === 'AbortError'
          setTurns((prev) => [
            ...prev,
            {
              id: nextId(),
              role: 'assistant',
              // A stopped stream keeps whatever arrived; it was real output, and
              // discarding it would lose an answer the user chose to cut short.
              content: aborted ? extractAction(acc).display : '',
              error: aborted ? undefined : (err as Error).message,
            },
          ])
          setStreaming('')
          setStatus(aborted ? 'idle' : 'error')
        } finally {
          abortRef.current = null
        }
      }
    },
    [context, counts, onAction, status]
  )

  return { turns, status, streaming, send, stop, reset, context }
}
