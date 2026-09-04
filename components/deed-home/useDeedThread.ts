'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { apiUrl } from '@/lib/api'
import { contextPreamble, type DeedContext } from '@/lib/deed/context'
import { intentToQuery, parseAuctionIntent, type AuctionIntent } from '@/lib/deed/intent'
import {
  extractAction,
  readDeedStream,
  trimForWorker,
  type DeedMessage,
} from '@/lib/deed/protocol'
import {
  loadThread,
  newId,
  saveThread,
  titleFrom,
  type AuctionCardData,
  type CardSet,
  type Thread,
  type ThreadTurn,
} from '@/lib/deed/threads'
import { useAuctionCounts } from '@/components/shell/useAuctionCounts'

export type ThreadStatus = 'idle' | 'streaming' | 'error'

const HOME_CONTEXT: DeedContext = {
  path: '/',
  surface: 'the BidDeed.AI home conversation',
  county: null,
  saleType: null,
  view: null,
  parcelId: null,
}

/**
 * The conversation engine for the home surface.
 *
 * Two things happen on every send, in parallel:
 *  1. `parseAuctionIntent` reads the message. If it names inventory (a county,
 *     a sale type, a time window) the hook fetches matching rows from
 *     /api/auctions and attaches them to the assistant turn as cards. Cards are
 *     on screen in a few hundred milliseconds — before the model has said a
 *     word — and they are the workspace's own rows, so they cannot disagree
 *     with /radar.
 *  2. The message goes to the Worker through /api/deed (same contract as the
 *     side panel) and the answer streams into the same assistant turn.
 *
 * Persistence is a side effect: every settled turn is written to localStorage
 * so the sidebar's "Recent" list and /?c=<id> reloads work.
 */
export function useDeedThread(initialId: string | null) {
  const [thread, setThread] = useState<Thread | null>(null)
  const [status, setStatus] = useState<ThreadStatus>('idle')
  const [streaming, setStreaming] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const counts = useAuctionCounts()

  // Load (or fail to load) the thread named in the URL. Runs on the client
  // only; the server renders the empty hero, which is also what a new visitor
  // sees, so there is no hydration mismatch to manage.
  const threadRef = useRef<Thread | null>(null)
  threadRef.current = thread

  useEffect(() => {
    if (!initialId) {
      // "New chat": drop the thread and cut any answer still streaming into it.
      abortRef.current?.abort()
      abortRef.current = null
      setThread(null)
      setStreaming('')
      setStatus('idle')
      return
    }
    // The URL catching up with a thread this page just created (send() →
    // router.replace) is not a reload: the live state, with its pending turn,
    // is the truth. Only a thread we do not hold yet is read from storage.
    if (threadRef.current?.id === initialId) return
    const found = loadThread(initialId)
    setThread(found)
    // Card rows in a reopened thread are re-fetched so a sale that has since
    // been cancelled does not render as biddable.
    if (found) {
      found.turns.forEach((t) => {
        if (t.cards) void refreshCards(found.id, t.id, t.cards.intent)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId])

  // Persistence is an effect, never a call inside a state updater: React runs
  // updater functions during render, and saveThread() dispatches the event the
  // sidebar listens to, so writing from inside one would set the sidebar's
  // state while this component is still rendering.
  useEffect(() => {
    if (thread && thread.turns.length > 0) saveThread(thread)
  }, [thread])

  const patchTurn = useCallback((threadId: string, turnId: string, patch: Partial<ThreadTurn>) => {
    setThread((prev) => {
      if (!prev || prev.id !== threadId) return prev
      const next = {
        ...prev,
        updatedAt: Date.now(),
        turns: prev.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)),
      }
      return next
    })
  }, [])

  async function refreshCards(threadId: string, turnId: string, intent: AuctionIntent) {
    const fetchRows = async (q: AuctionIntent) => {
      // A price cap is applied here, not in the query (the API has no
      // opening_bid filter), so pull a wider page to filter from.
      const res = await fetch(apiUrl(intentToQuery(q, q.maxOpeningBid ? 40 : 6)))
      if (!res.ok) throw new Error(`Auction data returned ${res.status}`)
      const json = (await res.json()) as { data?: AuctionCardData[]; total?: number | null }
      let rows = Array.isArray(json.data) ? json.data : []
      let total: number | null = json.total ?? null
      let bidUnknown = false
      if (q.maxOpeningBid) {
        const known = rows.filter((r) => r.opening_bid != null && r.opening_bid > 0 && r.opening_bid <= q.maxOpeningBid!)
        if (known.length > 0) {
          rows = known
        } else {
          // Nothing priced under the cap yet — clerks publish opening bids
          // late. Show the sales whose bid is not published rather than an
          // empty grid, and say so.
          rows = rows.filter((r) => r.opening_bid == null || r.opening_bid <= 0)
          bidUnknown = rows.length > 0
        }
        total = rows.length
        rows = rows.slice(0, 6)
      }
      return { rows, total, bidUnknown }
    }
    try {
      let { rows, total, bidUnknown } = await fetchRows(intent)
      let widened = false
      // "This week in Brevard" with nothing on the calendar this week is a real
      // answer, but a dead end. Widen once to the next upcoming sales for the
      // same county and type, and say so in the header.
      if (rows.length === 0 && (intent.from || intent.to)) {
        const wide = await fetchRows({ ...intent, from: null, to: null })
        if (wide.rows.length > 0) {
          rows = wide.rows
          total = wide.total
          bidUnknown = wide.bidUnknown
          widened = true
        }
      }
      patchTurn(threadId, turnId, {
        cards: { intent, rows, total, loading: false, widened, bidUnknown },
      })
    } catch (err) {
      patchTurn(threadId, turnId, {
        cards: { intent, rows: [], total: null, loading: false, error: (err as Error).message },
      })
    }
  }

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || status === 'streaming') return

      const now = Date.now()
      const base: Thread = thread ?? {
        id: newId(),
        title: titleFrom(trimmed),
        createdAt: now,
        updatedAt: now,
        turns: [],
      }
      const userTurn: ThreadTurn = { id: newId(), role: 'user', content: trimmed, createdAt: now }
      const intent = parseAuctionIntent(trimmed)
      const cards: CardSet | undefined = intent
        ? { intent, rows: [], total: null, loading: true }
        : undefined
      const assistantTurn: ThreadTurn = {
        id: newId(),
        role: 'assistant',
        content: '',
        createdAt: now + 1,
        cards,
        pending: true,
      }

      const history: DeedMessage[] = base.turns
        .filter((t) => !t.pending && (t.content || t.error))
        .map((t) => ({ role: t.role, content: t.content || '(no answer)' }))

      const next: Thread = {
        ...base,
        updatedAt: now,
        turns: [...base.turns, userTurn, assistantTurn],
      }
      setThread(next)

      if (intent) void refreshCards(next.id, assistantTurn.id, intent)

      const wire = trimForWorker([
        ...history,
        {
          role: 'user',
          content: [
            contextPreamble(HOME_CONTEXT, counts),
            intent
              ? `The page is ALREADY showing the customer a card grid of ${intent.label.toLowerCase()} from /api/auctions. Do not retype those rows as a table; add what the cards cannot: what to check before bidding, how the Shapira Max Bid is reached, and what a SIGNAL$ Property Report adds. Keep it under 180 words.`
              : 'Keep the answer under 220 words, in plain language for a property investor. No developer or database terminology.',
            '',
            trimmed,
          ].join('\n'),
        },
      ])

      void run(next.id, assistantTurn.id, wire, intent)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thread, status, counts]
  )

  async function run(threadId: string, turnId: string, wire: DeedMessage[], intent: AuctionIntent | null) {
    setStatus('streaming')
    setStreaming('')
    const controller = new AbortController()
    abortRef.current = controller
    let acc = ''

    try {
      const res = await fetch(apiUrl('/api/deed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: wire, county: intent?.county ?? null, hook: 'home' }),
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
        const cut = acc.indexOf('[[ACTION')
        setStreaming(cut === -1 ? acc : acc.slice(0, cut))
      })
      const { action, display } = extractAction(acc)
      finish(threadId, turnId, { content: display, action: action ?? null, pending: false })
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError'
      finish(threadId, turnId, {
        content: aborted ? extractAction(acc).display : '',
        error: aborted ? undefined : (err as Error).message,
        pending: false,
      })
      if (!aborted) setStatus('error')
    } finally {
      abortRef.current = null
    }
  }

  function finish(threadId: string, turnId: string, patch: Partial<ThreadTurn>) {
    setStreaming('')
    setStatus((s) => (s === 'error' ? s : 'idle'))
    patchTurn(threadId, turnId, patch)
  }

  const reset = useCallback(() => {
    stop()
    setThread(null)
    setStreaming('')
    setStatus('idle')
  }, [stop])

  return { thread, status, streaming, send, stop, reset }
}
