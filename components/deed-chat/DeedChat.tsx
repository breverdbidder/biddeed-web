'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import Composer from '@/components/deed-home/Composer'
import { DEED_SEEDS } from '@/components/deed-home/deedSeeds'
import ThreadView from '@/components/deed-home/ThreadView'
import { useDeedThread, type DeedSendOptions } from '@/components/deed-home/useDeedThread'
import { useDeedAuth } from '@/lib/deed/deedAuth'
import { createProject, notifyProjectsChanged } from '@/lib/deed/projectsRemote'
import ChatEmptyState from './ChatEmptyState'
import ProjectPanel from './ProjectPanel'
import ProjectsSheet, { draftPrompt, type ProjectDraft } from './ProjectsSheet'

const PROJECT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
 *   /chat?project=<id>    a project (CP-4): header, files, and a chat scoped to it;
 *                         &new=1 starts another chat inside the same project
 *   /chat#projects        open the Projects panel (sidebar row, legacy links)
 *   /chat?new_project_county=&case=&source=&intent=
 *                         the S2 hook (#19847): signed in, the project is created
 *                         with first_touch and opened; signed out, the panel opens
 *                         with the draft and a sign-in that returns here
 *
 * Every param is stripped after it is consumed, so a reload never re-seeds,
 * re-creates or re-opens anything.
 */
export default function DeedChat() {
  const router = useRouter()
  const params = useSearchParams()
  const auth = useDeedAuth()
  const wantsNew = params.get('new') === '1'
  const threadId = wantsNew ? null : params.get('c')
  const projectParam = params.get('project')
  const projectFromUrl = projectParam && PROJECT_ID_RE.test(projectParam) ? projectParam : null
  const { thread, status, streaming, send, stop } = useDeedThread(threadId, { projectId: projectFromUrl })
  const [seed, setSeed] = useState<string | null>(null)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null)

  // The project this page is about: the thread's own, else the URL's.
  const activeProjectId = thread?.projectId ?? projectFromUrl

  // ?new=1 → a clean /chat (or a clean chat inside the project). The thread
  // state is already null (threadId is null while wantsNew), so this is only
  // the URL catching up.
  useEffect(() => {
    if (wantsNew) router.replace(projectFromUrl ? `/chat?project=${encodeURIComponent(projectFromUrl)}` : '/chat', { scroll: false })
  }, [wantsNew, projectFromUrl, router])

  // ?deed=<key> deep link (same map and same rules as the home page).
  const deedKey = params.get('deed')
  useEffect(() => {
    if (!deedKey) return
    const prompt = DEED_SEEDS[deedKey]
    if (prompt) setSeed(prompt)
    router.replace(threadId ? `/chat?c=${encodeURIComponent(threadId)}` : '/chat', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deedKey])

  // Auctions / county pages → "start a project for this sale" (#19847 S2).
  // Waits for Clerk's first answer so a signed-in customer never sees the
  // sign-in door flash before the project opens.
  const draftCounty = params.get('new_project_county')
  useEffect(() => {
    if (!draftCounty || !auth.loaded) return
    const draft: ProjectDraft = {
      county: draftCounty,
      caseNumber: params.get('case'),
      source: params.get('source'),
      intent: params.get('intent'),
    }
    if (!auth.signedIn) {
      setProjectDraft(draft)
      setProjectsOpen(true)
      router.replace('/chat', { scroll: false })
      return
    }
    let cancelled = false
    void createProject({
      county: draft.county,
      case_number: draft.caseNumber,
      first_touch: { source: draft.source ?? 'hook', county: draft.county, case: draft.caseNumber ?? '', intent: draft.intent ?? '' },
    }).then((r) => {
      if (cancelled) return
      if (r.ok) {
        notifyProjectsChanged()
        setSeed(draftPrompt(draft))
        router.replace(`/chat?project=${encodeURIComponent(r.data.project.id)}`, { scroll: false })
      } else {
        // Tables not applied yet (503) or a bad county: fall back to the panel
        // with the draft so nothing the customer clicked is lost.
        setProjectDraft(draft)
        setProjectsOpen(true)
        router.replace('/chat', { scroll: false })
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCounty, auth.loaded, auth.signedIn])

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
  // navigation, so back/forward, reload and the sidebar all agree. The
  // thread carries its projectId, so the project header stays.
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

  const openProject = useCallback(
    (id: string) => {
      setProjectsOpen(false)
      setProjectDraft(null)
      router.push(`/chat?project=${encodeURIComponent(id)}`)
    },
    [router]
  )

  const streamingNow = status === 'streaming'
  const inThread = Boolean(thread && thread.turns.length > 0)
  const panel = activeProjectId ? (
    <ProjectPanel projectId={activeProjectId} activeThreadId={thread?.id ?? null} onDeleted={() => router.replace('/chat')} />
  ) : null

  return (
    <>
      {inThread && thread ? (
        <div className="flex h-[calc(100svh-3.5rem)] min-h-[24rem] flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel}
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
      ) : activeProjectId ? (
        <div className="flex h-[calc(100svh-3.5rem)] min-h-[24rem] flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel}
            <p className="mx-auto w-full max-w-3xl px-4 pt-6 text-base leading-6 text-muted-foreground sm:px-6 sm:text-[15px]">
              Ask Deed anything about this property. Files in the project are cited by name.
            </p>
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
                projectId={activeProjectId}
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
        onOpenProject={openProject}
      />
    </>
  )
}
