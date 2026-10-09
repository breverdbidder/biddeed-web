'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { apiUrl } from '@/lib/api'
import { contextPreamble, type DeedContext } from '@/lib/deed/context'
import { useDeedAuth } from '@/lib/deed/deedAuth'
import { getThread, notifyThreadsChanged, putThread } from '@/lib/deed/threadsRemote'
import { intentToQuery, parseAuctionIntent, type AuctionIntent } from '@/lib/deed/intent'
import { emptyLifecycle, foldEvent, readAguiStream, type AguiEvent } from '@/lib/deed/agui-client'
import { readLifecycleIntent } from '@/lib/deed/lifecycle-intent'
import { track } from '@/lib/analytics/funnel'
import { wantsDeedPlan, type DeedPlanResult, type PlanSet } from '@/lib/deed/plan'
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

export interface DeedSendOptions {
  /** id returned by POST /api/deed/upload — cited by Deed if extraction succeeded. */
  uploadId?: string
  /** Filename shown as a chip under the user's turn — display only. */
  uploadLabel?: string
  /** "Public-records search" toggle from the composer's "+" menu. */
  publicRecords?: boolean
  /** Scopes this message (and the rest of the thread) to a Project (#19847 C3). */
  projectId?: string | null
}

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
 * Persistence is a side effect (PARITY CP-3): for a signed-in customer every
 * settled turn is PUT to /api/deed/threads under their Clerk sub, so the
 * sidebar's "Recent" list, search and /chat?c=<id> reloads work on any
 * device. Signed out, nothing is stored anywhere (issue #20226) — the thread
 * lives in this tab's React state and no longer.
 */
export function useDeedThread(initialId: string | null, opts: { projectId?: string | null } = {}) {
  // /chat?project=<id>: a fresh thread started here belongs to that project
  // (S4). A reopened thread keeps its own projectId regardless.
  const defaultProjectId = opts.projectId ?? null
  const [thread, setThread] = useState<Thread | null>(null)
  const [status, setStatus] = useState<ThreadStatus>('idle')
  const [streaming, setStreaming] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const counts = useAuctionCounts()
  const auth = useDeedAuth()
  const signedIn = auth.loaded && auth.signedIn

  // Load (or fail to load) the thread named in the URL. Runs on the client
  // only; the server renders the empty hero, which is also what a new visitor
  // sees, so there is no hydration mismatch to manage.
  const threadRef = useRef<Thread | null>(null)
  threadRef.current = thread

  // The last ?c= this effect saw. The effect also re-runs when Clerk finishes
  // loading (auth.loaded / signedIn change), and on a fresh page ?c= is still
  // empty at that moment: treating that re-run as "New chat" aborted the first
  // message's stream and wiped the thread whenever it was sent before Clerk
  // loaded (reproduced on biddeed.ai 2026-09-23: 2 of 3 first messages lost,
  // POST /api/deed net::ERR_ABORTED, then the empty greeting under ?c=).
  const lastInitialId = useRef(initialId)

  useEffect(() => {
    const idChanged = lastInitialId.current !== initialId
    lastInitialId.current = initialId
    if (!initialId) {
      // Only a real move to "New chat" (?c= dropped) resets; an auth re-run
      // on a page that never had a ?c= must leave the live thread alone.
      if (!idChanged) return
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
    // Wait for Clerk's first answer so a signed-in reload is not first read
    // as anonymous (which would find nothing and paint the empty state).
    if (!auth.loaded) return
    let cancelled = false
    const apply = (found: Thread | null) => {
      if (cancelled) return
      setThread(found)
      // Card rows in a reopened thread are re-fetched so a sale that has since
      // been cancelled does not render as biddable.
      if (found) {
        found.turns.forEach((t) => {
          if (t.plan) void refreshPlan(found.id, t.id, t.plan.query)
          else if (t.cards) void refreshCards(found.id, t.id, t.cards.intent)
        })
      }
    }
    if (signedIn) void getThread(initialId).then(apply)
    else apply(loadThread(initialId))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, auth.loaded, signedIn])

  // Persistence is an effect, never a call inside a state updater: React runs
  // updater functions during render, and saveThread() dispatches the event the
  // sidebar listens to, so writing from inside one would set the sidebar's
  // state while this component is still rendering.
  //
  // Signed in: PUT the thread once no turn is pending (debounced, so a burst
  // of card patches is one write). The sidebar refreshes on the notify.
  useEffect(() => {
    if (!thread || thread.turns.length === 0) return
    // Lifecycle cards (order read-backs, hosted links) are live state, never stored.
    const storable: Thread = { ...thread, turns: thread.turns.map(({ lifecycle: _lifecycle, ...t }) => t) }
    if (!signedIn) {
      saveThread(storable)
      return
    }
    if (thread.turns.some((t) => t.pending)) return
    const handle = setTimeout(() => {
      void putThread(storable).then((ok) => {
        if (ok) notifyThreadsChanged()
      })
    }, 400)
    return () => clearTimeout(handle)
  }, [thread, signedIn])

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

  // Ask Deed: the orchestrator runs the specialist agents server-side
  // (mcp.biddeed.ai/deed/ask via /api/deed/plan) and the turn renders its
  // plan. Re-run, never replayed, when a saved thread is reopened: auction
  // calendars and storefront availability change daily.
  async function refreshPlan(threadId: string, turnId: string, query: string) {
    patchTurn(threadId, turnId, { plan: { query, loading: true } })
    try {
      const res = await fetch(apiUrl('/api/deed/plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const json = (await res.json().catch(() => ({}))) as DeedPlanResult & { error?: string }
      if (!res.ok || json.error) throw new Error(json.error || `Deed returned ${res.status}`)
      patchTurn(threadId, turnId, { plan: { query, loading: false, plan: json } })
    } catch (err) {
      patchTurn(threadId, turnId, { plan: { query, loading: false, error: (err as Error).message } })
    }
  }

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const send = useCallback(
    (text: string, opts: DeedSendOptions = {}) => {
      const trimmed = text.trim()
      if ((!trimmed && !opts.uploadId) || status === 'streaming') return

      const now = Date.now()
      const base: Thread = thread ?? {
        id: newId(),
        title: titleFrom(trimmed || opts.uploadLabel || 'New conversation'),
        createdAt: now,
        updatedAt: now,
        turns: [],
      }
      // A project, once picked, scopes the rest of this thread — not just the
      // message that picked it — mirroring the Worker's own chatState.projectId
      // persistence in src/worker.js.
      const projectId = opts.projectId !== undefined ? opts.projectId : (base.projectId ?? defaultProjectId)
      const userTurn: ThreadTurn = {
        id: newId(),
        role: 'user',
        content: trimmed,
        createdAt: now,
        attachmentLabel: opts.uploadLabel,
      }
      // A plan / billing request ("how much is Pro", "buy Investor", "cancel my
      // plan") is a lifecycle run: deterministic, streamed as AG-UI events, and
      // it can only ever stop at a Confirm card (issue #20664).
      const lifecycleIntent = !opts.uploadId ? readLifecycleIntent(trimmed) : null
      if (lifecycleIntent) {
        const lcTurn: ThreadTurn = { id: newId(), role: 'assistant', content: '', createdAt: now + 1, pending: true, lifecycle: emptyLifecycle() }
        const lcNext: Thread = { ...base, updatedAt: now, turns: [...base.turns, userTurn, lcTurn], projectId }
        setThread(lcNext)
        if (!signedIn) {
          finish(lcNext.id, lcTurn.id, {
            content: auth.enabled
              ? 'Sign in to manage your plan here — I can quote prices, set up an order for you to confirm, and open your billing page. Use the sign-in button in the sidebar, then ask again.'
              : 'Sign in to manage your plan here.',
            pending: false,
            lifecycle: undefined,
          })
          return
        }
        void runLifecycle(lcNext.id, lcTurn.id, '/api/deed/run', { text: trimmed, thread_id: lcNext.id })
        return
      }

      // A message with buying criteria ("Brevard Tuesday, ARV over $300K,
      // 25% margin") is Deed's to orchestrate; a plain browse ("Brevard this
      // week") keeps the card grid.
      const planWanted = !opts.uploadId && wantsDeedPlan(trimmed)
      const intent = planWanted ? null : parseAuctionIntent(trimmed)
      const plan: PlanSet | undefined = planWanted ? { query: trimmed, loading: true } : undefined
      const cards: CardSet | undefined = intent
        ? { intent, rows: [], total: null, loading: true }
        : undefined
      const assistantTurn: ThreadTurn = {
        id: newId(),
        role: 'assistant',
        content: '',
        createdAt: now + 1,
        cards,
        plan,
        pending: true,
      }

      const history: DeedMessage[] = base.turns
        .filter((t) => !t.pending && (t.content || t.error))
        .map((t) => ({ role: t.role, content: t.content || '(no answer)' }))

      const next: Thread = {
        ...base,
        updatedAt: now,
        turns: [...base.turns, userTurn, assistantTurn],
        projectId,
      }
      setThread(next)

      if (intent) void refreshCards(next.id, assistantTurn.id, intent)
      if (plan) void refreshPlan(next.id, assistantTurn.id, plan.query)

      const wire = trimForWorker([
        ...history,
        {
          role: 'user',
          content: [
            contextPreamble(HOME_CONTEXT, counts),
            plan
              ? 'The page is ALREADY showing the customer Deed\'s plan for this request: the specialist agents (auction calendar, property record, title search, rehab scope, insurance cost) ran on the matching sales and each property is screened on public figures, with a $25 SIGNAL$ Property Report checkout on every sellable one. You do not see the results, so do not invent addresses or numbers. In under 120 words: say Deed ran those checks, that the screen uses the county just value (not an ARV) and is triage only, and that the SIGNAL$ Property Report adds the value estimate, the SIGNAL$ Max Bid, the lien-survival analysis and the bid verdict.'
              : intent
              ? `The page is ALREADY showing the customer a card grid of ${intent.label.toLowerCase()} from /api/auctions. Do not retype those rows as a table; add what the cards cannot: what to check before bidding, how the SIGNAL$ Max Bid is reached, and what a SIGNAL$ Property Report adds. Keep it under 180 words.`
              : 'Keep the answer under 220 words, in plain language for a property investor. No developer or database terminology.',
            '',
            trimmed || '(no message text — see the attached file)',
          ].join('\n'),
        },
      ])

      void run(next.id, assistantTurn.id, wire, intent, { ...opts, projectId })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thread, status, counts, defaultProjectId, signedIn, auth.enabled]
  )

  const patchThreadMeta = useCallback((threadId: string, patch: Partial<Thread>) => {
    setThread((prev) => (prev && prev.id === threadId ? { ...prev, ...patch } : prev))
  }, [])

  async function run(
    threadId: string,
    turnId: string,
    wire: DeedMessage[],
    intent: AuctionIntent | null,
    opts: DeedSendOptions
  ) {
    setStatus('streaming')
    setStreaming('')
    const controller = new AbortController()
    abortRef.current = controller
    let acc = ''

    try {
      // No identity header: /api/deed verifies the Clerk session itself when
      // an upload is cited, and the Worker never receives one (CP-3).
      const res = await fetch(apiUrl('/api/deed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: wire,
          county: intent?.county ?? null,
          hook: 'home',
          upload_id: opts.uploadId,
          public_records: opts.publicRecords || undefined,
          // Project scope (CP-4): the route folds the project's files in for
          // the signed-in owner and names them back in X-Deed-Cited.
          project_id: opts.projectId || undefined,
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
      await readDeedStream(
        res.body,
        (delta) => {
          acc += delta
          const cut = acc.indexOf('[[ACTION')
          setStreaming(cut === -1 ? acc : acc.slice(0, cut))
        },
        (meta) => {
          if (meta.conversationId) patchThreadMeta(threadId, { workerConversationId: meta.conversationId })
        }
      )
      const { action, display } = extractAction(acc)
      const citedHeader = res.headers.get('x-deed-cited')
      const cited = citedHeader ? decodeURIComponent(citedHeader).split('|').filter(Boolean) : []
      finish(threadId, turnId, { content: display, action: action ?? null, pending: false, cited: cited.length ? cited : undefined })
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

  function trackLifecycle(e: AguiEvent) {
    const v = (e.value ?? {}) as Record<string, unknown>
    if (e.type === 'RUN_STARTED') track('ask_deed_run_started', { channel: 'chat', source: 'ask_deed', surface: 'chat' })
    else if (e.type === 'CUSTOM' && e.name === 'deed.quote_card')
      track('ask_deed_quote_shown', { channel: 'chat', source: 'ask_deed', surface: 'chat', plan: v.tier as string | undefined, price_usd: v.amount_usd as number | undefined })
    else if (e.type === 'CUSTOM' && e.name === 'deed.checkout_card')
      track(
        'checkout_started',
        { channel: 'chat', source: 'ask_deed', surface: 'chat', product: v.product === 'report' ? 'signal_report' : 'subscription', price_usd: v.amount_usd as number | undefined },
        { beacon: true }
      )
  }

  // One AG-UI run into one assistant turn. The same reader serves the lifecycle
  // route and the confirm route; neither lets a typed or streamed word move money.
  async function runLifecycle(
    threadId: string,
    turnId: string,
    url: string,
    payload: Record<string, unknown>,
    onSettled?: (ok: boolean) => void
  ) {
    setStatus('streaming')
    setStreaming('')
    const controller = new AbortController()
    abortRef.current = controller
    let lc = emptyLifecycle()
    try {
      const res = await fetch(apiUrl(url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const detail = res.status === 204 ? null : await res.json().then((j: { error?: string }) => j.error).catch(() => null)
        finish(threadId, turnId, { content: detail || 'I could not start that just now. Nothing was charged.', pending: false, lifecycle: undefined })
        onSettled?.(false)
        return
      }
      await readAguiStream(res.body, (e) => {
        lc = foldEvent(lc, e)
        trackLifecycle(e)
        setStreaming(lc.text)
        patchTurn(threadId, turnId, { lifecycle: lc })
      })
      finish(threadId, turnId, { content: lc.text, error: lc.error, pending: false, lifecycle: lc })
      onSettled?.(!lc.error && lc.cards.some((c) => c.kind === 'checkout' || c.kind === 'link'))
    } catch (err) {
      const aborted = (err as Error)?.name === 'AbortError'
      finish(threadId, turnId, { content: lc.text, error: aborted ? undefined : (err as Error).message, pending: false, lifecycle: lc })
      if (!aborted) setStatus('error')
      onSettled?.(false)
    } finally {
      abortRef.current = null
    }
  }

  // The Confirm button. Marks the card, runs the confirm route, and lands the
  // result (checkout / billing link) as a new assistant turn.
  const confirmOrder = useCallback(
    (turnId: string, ref: string) => {
      const t = threadRef.current
      if (!t || status === 'streaming') return
      const setCard = (state: 'working' | 'done' | 'failed') =>
        setThread((prev) =>
          prev
            ? {
                ...prev,
                turns: prev.turns.map((x) =>
                  x.id === turnId && x.lifecycle
                    ? { ...x, lifecycle: { ...x.lifecycle, cards: x.lifecycle.cards.map((c) => (c.kind === 'confirm' && c.ref === ref ? { ...c, state } : c)) } }
                    : x
                ),
              }
            : prev
        )
      setCard('working')
      const lcTurn: ThreadTurn = { id: newId(), role: 'assistant', content: '', createdAt: Date.now(), pending: true, lifecycle: emptyLifecycle() }
      setThread((prev) => (prev ? { ...prev, turns: [...prev.turns, lcTurn] } : prev))
      void runLifecycle(t.id, lcTurn.id, '/api/deed/confirm', { ref }, (ok) => setCard(ok ? 'done' : 'failed'))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status]
  )

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

  return { thread, status, streaming, send, stop, reset, confirmOrder }
}
