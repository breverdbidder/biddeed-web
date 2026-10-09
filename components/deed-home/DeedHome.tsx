'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'

import DeedRobotMark from '@/components/deed/DeedRobotMark'
import { cn } from '@/lib/utils'
import Composer from './Composer'
import { DEED_SEEDS } from './deedSeeds'
import { DEED_PROMPT_ATTR } from './deedPromptEvent'
import PromptStarters from './PromptStarters'
import TrustStrip from './TrustStrip'
import { useDeedThread, type DeedSendOptions } from './useDeedThread'

// The thread view carries the markdown stack (react-markdown + remark-gfm +
// micromark, ~51 KiB compressed) and only renders once a message has been
// sent. Loaded on demand so the landing page does not ship it to every first
// visit (PageSpeed pass, 2026-10-07).
const ThreadView = dynamic(() => import('./ThreadView'))

/**
 * The home page is a conversation.
 *
 * Empty state: one question box in the middle of the screen, five prompt
 * starters under it, and the evidence (live counts, the Marion proof, how it
 * works, plans) below the fold. The moment a customer sends a message the
 * same page becomes the thread — the composer docks to the bottom, the
 * marketing leaves, and the URL gains ?c=<id> so a reload or the sidebar's
 * "Recent" list brings the conversation back.
 *
 * /chat (app/chat, PARITY CP-2) is the same conversation without the
 * marketing below the fold — same engine, same composer, same thread store.
 * The Cloudflare Worker in front of this app proxies both paths to it.
 *
 * `below` is that marketing: the map module and the evidence sections,
 * rendered on the server by app/page.tsx (HomeBelowFold) and passed in as
 * finished HTML, so none of it ships as client code (PageSpeed pass 3).
 */
export default function DeedHome({ below }: { below?: React.ReactNode }) {
  const router = useRouter()
  const params = useSearchParams()
  const threadId = params.get('c')
  const { thread, status, streaming, send, stop, confirmOrder } = useDeedThread(threadId)
  const [seed, setSeed] = useState<string | null>(null)

  // ?deed=<key> deep link: prefill the composer from the fixed seed map
  // (unknown keys are ignored), bring the composer into view, and strip the
  // param so a reload does not re-seed.
  const deedKey = params.get('deed')
  useEffect(() => {
    if (!deedKey) return
    const prompt = DEED_SEEDS[deedKey]
    if (prompt) {
      setSeed(prompt)
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    router.replace(threadId ? `/?c=${encodeURIComponent(threadId)}` : '/', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deedKey])

  // First send on a fresh page: put the thread id in the URL without a
  // navigation, so back/forward and reload behave like a real page.
  useEffect(() => {
    if (thread && thread.id !== threadId) {
      router.replace(`/?c=${encodeURIComponent(thread.id)}`, { scroll: false })
    }
  }, [thread, threadId, router])

  const onSend = useCallback(
    (text: string, opts?: DeedSendOptions) => {
      send(text, opts)
      // A prompt-starter click on the marketing sections below the fold sends
      // from far down the page; bring the thread into view.
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [send]
  )

  // Plan-card "ask Deed" buttons live in the server-rendered sections below
  // the fold: they carry their prompt in data-deed-prompt and this one
  // delegated listener sends it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest?.(`[${DEED_PROMPT_ATTR}]`)
      const prompt = btn?.getAttribute(DEED_PROMPT_ATTR)
      if (prompt) onSend(prompt)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [onSend])

  const streamingNow = status === 'streaming'
  const inThread = Boolean(thread && thread.turns.length > 0)

  if (inThread && thread) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] min-h-[24rem] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ThreadView thread={thread} streaming={streaming} onConfirm={confirmOrder} />
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
              projectId={thread?.projectId ?? null}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      {/* ── Hero: the product ─────────────────────────────────────────── */}
      <section
        className={cn(
          'relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-center px-4 py-12 sm:px-6 sm:py-16',
          'bg-[radial-gradient(60%_50%_at_50%_35%,hsl(var(--primary)/0.10),transparent_70%)]'
        )}
      >
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="mx-auto flex items-center justify-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card">
              <DeedRobotMark size={24} decorative={false} />
            </span>
            <span className="text-sm font-medium text-muted-foreground">Deed · the <a href="/academy" className="underline underline-offset-2 transition-colors hover:text-foreground -my-2 py-2">biddeed.ai</a> agent</span>
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            DATA IS THE MOAT.
          </p>

          <h1 className="font-display mx-auto mt-6 max-w-2xl text-[2.1rem] font-medium leading-[1.12] tracking-tight text-foreground sm:text-[2.75rem] lg:text-[3.1rem]">
            THE BEST PRICES IN US REAL ESTATE ARE SET AT FORECLOSURE AND TAX DEED AUCTIONS.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-[17px]">
            {/* Was "every US county auction" while the feed covers 67 Florida counties
                plus Bexar County, TX (REA teardown 2026-10-09). The claim now matches
                coverage and grows with it. */}
            Our data is your unfair advantage at every county auction we cover.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-base leading-7 text-muted-foreground sm:text-[17px]">
            <a href="/maps" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 -my-2 py-2">biddeed.ai</a> is the moat for real estate auction intelligence and bidding in the USA. All the rest are wrappers.
          </p>

          <div className="mt-8 text-left">
            <Composer
              variant="hero"
              onSend={onSend}
              onStop={stop}
              streaming={streamingNow}
              seed={seed}
              onSeedConsumed={() => setSeed(null)}
            />
          </div>

          <PromptStarters onPick={(p) => setSeed(p)} className="mt-4" />

          <div className="mt-10">
            <TrustStrip />
          </div>
        </div>
      </section>

      {below}
    </div>
  )
}
