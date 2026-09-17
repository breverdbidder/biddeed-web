'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import Composer from '@/components/deed-home/Composer'
import { DEED_SEEDS } from '@/components/deed-home/deedSeeds'
import ThreadView from '@/components/deed-home/ThreadView'
import { useDeedThread, type DeedSendOptions } from '@/components/deed-home/useDeedThread'
import ChatEmptyState from './ChatEmptyState'
import ProjectsSheet, { type ProjectDraft } from './ProjectsSheet'

/**
 * /chat — the conversation, and nothing else (PARITY CP-2 §1–§3).
 *
 * Same engine as '/': useDeedThread streams from the Worker through
 * /api/deed, ThreadView renders the turns, Composer is the one input on every
 * surface. What differs from the home page is only what is NOT here — no
 * marketing sections, no map module — and the URL contract:
 *
 *   /chat                 empty state (serif greeting + four suggestion chips)
 *   /chat?c=<id>          reopen a saved thread (the sidebar "Recent" links)
 *   /chat?new=1           start fresh — kept for the Worker-era links
 *   /chat?deed=<key>      prefill the composer from the fixed seed map
 *   /chat#projects        open the Projects panel (sidebar row, legacy links)
 *   /chat?new_project_county=&case=&source=  the Auctions "start a project"
 *                         hook (#19847 S2) — opens the panel with the draft
 *
 * Every param is stripped after it is consumed, so a reload never re-seeds,
 * re-creates or re-opens anything.
 */
export default function DeedChat() {
  const router = useRouter()
  const params = useSearchParams()
  const wantsNew = params.get('new') === '1'
  const threadId = wantsNew ? null : params.get('c')
  const { thread, status, streaming, send, stop } = useDeedThread(threadId)
  const [seed, setSeed] = useState<string | null>(null)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null)

  // ?new=1 → a clean /chat. The thread state is already null (threadId is
  // null while wantsNew), so this is only the URL catching up.
  useEffect(() => {
    if (wantsNew) router.replace('/chat', { scroll: false })
  }, [wantsNew, router])

  // ?deed=<key> deep link (same map and same rules as the home page).
  const deedKey = params.get('deed')
  useEffect(() => {
    if (!deedKey) return
    const prompt = DEED_SEEDS[deedKey]
    if (prompt) setSeed(prompt)
    router.replace(threadId ? `/chat?c=${encodeURIComponent(threadId)}` : '/chat', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deedKey])

  // Auctions → "start a project for this sale" (#19847 S2). The Worker shell
  // created the project server-side and opened its drawer; here the panel
  // opens with the draft and the composer can be seeded from it.
  const draftCounty = params.get('new_project_county')
  useEffect(() => {
    if (!draftCounty) return
    setProjectDraft({
      county: draftCounty,
      caseNumber: params.get('case'),
      source: params.get('source'),
      intent: params.get('intent'),
    })
    setProjectsOpen(true)
    router.replace('/chat', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCounty])

  // #projects — the sidebar row and every legacy /chat#projects link. A hash
  // change on the same page is not a navigation Next sees, so listen for it.
  useEffect(() => {
    const check = () => {
      if (typeof window !== 'undefined' && window.location.hash === '#projects') {
        setProjectsOpen(true)
        // Leave the URL clean so closing the panel and reloading does not reopen it.
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])

  // First send on a fresh page: put the thread id in the URL without a
  // navigation, so back/forward, reload and the sidebar all agree.
  useEffect(() => {
    if (thread && thread.id !== threadId && !wantsNew) {
      router.replace(`/chat?c=${encodeURIComponent(thread.id)}`, { scroll: false })
    }
  }, [thread, threadId, wantsNew, router])

  const onSend = useCallback(
    (text: string, opts?: DeedSendOptions) => {
      send(text, opts)
    },
    [send]
  )

  const streamingNow = status === 'streaming'
  const inThread = Boolean(thread && thread.turns.length > 0)

  return (
    <>
      {inThread && thread ? (
        <div className="flex h-[calc(100svh-3.5rem)] min-h-[24rem] flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ThreadView thread={thread} streaming={streaming} />
          </div>
          <div className="shrink-0 border-t border-border bg-background/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <Composer
                variant="docked"
                onSend={onSend}
                onStop={stop}
                streaming={streamingNow}
                seed={seed}
                onSeedConsumed={() => setSeed(null)}
                autoFocus
                projectId={thread.projectId ?? null}
              />
            </div>
          </div>
        </div>
      ) : (
        <ChatEmptyState onPick={(p) => setSeed(p)}>
          <Composer
            variant="hero"
            onSend={onSend}
            onStop={stop}
            streaming={streamingNow}
            seed={seed}
            onSeedConsumed={() => setSeed(null)}
            autoFocus
          />
        </ChatEmptyState>
      )}

      <ProjectsSheet
        open={projectsOpen}
        onOpenChange={(open) => {
          setProjectsOpen(open)
          if (!open) setProjectDraft(null)
        }}
        draft={projectDraft}
        onAskDeed={(prompt) => {
          setProjectsOpen(false)
          setProjectDraft(null)
          setSeed(prompt)
        }}
      />
    </>
  )
}
