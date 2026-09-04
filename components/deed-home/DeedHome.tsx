'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import DeedRobotMark from '@/components/deed/DeedRobotMark'
import { cn } from '@/lib/utils'
import Composer from './Composer'
import { Footer, Founder, HowItWorks, Pricing, Proof, TrustStrip } from './LandingSections'
import PromptStarters from './PromptStarters'
import ThreadView from './ThreadView'
import { useDeedThread } from './useDeedThread'

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
 * There is no separate /chat app route because the Cloudflare Worker in front
 * of this app forwards only a fixed set of paths to it (see docs/UX_SPEC).
 */
export default function DeedHome() {
  const router = useRouter()
  const params = useSearchParams()
  const threadId = params.get('c')
  const { thread, status, streaming, send, stop } = useDeedThread(threadId)
  const [seed, setSeed] = useState<string | null>(null)

  // First send on a fresh page: put the thread id in the URL without a
  // navigation, so back/forward and reload behave like a real page.
  useEffect(() => {
    if (thread && thread.id !== threadId) {
      router.replace(`/?c=${encodeURIComponent(thread.id)}`, { scroll: false })
    }
  }, [thread, threadId, router])

  const onSend = useCallback(
    (text: string) => {
      send(text)
      // A prompt-starter click on the marketing sections below the fold sends
      // from far down the page; bring the thread into view.
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [send]
  )

  const streamingNow = status === 'streaming'
  const inThread = Boolean(thread && thread.turns.length > 0)

  if (inThread && thread) {
    return (
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
            <span className="text-sm font-medium text-muted-foreground">Deed · the BidDeed.AI agent</span>
          </div>

          <h1 className="font-display mx-auto mt-6 max-w-2xl text-[2.1rem] font-medium leading-[1.12] tracking-tight text-foreground sm:text-[2.75rem] lg:text-[3.1rem]">
            THE BEST PRICES IN US REAL ESTATE ARE SET AT FORECLOSURE AND TAX DEED AUCTIONS.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-[17px]">
            Our data is your unfair advantage at every US county auction.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-base leading-7 text-muted-foreground sm:text-[17px]">
            We fought in the trenches for over two decades so you don&rsquo;t have to.
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

      {/* ── Evidence ──────────────────────────────────────────────────── */}
      <div className="space-y-20 pb-20 pt-4 sm:space-y-28">
        <Proof />
        <Founder />
        <HowItWorks />
        <Pricing onPrompt={(p) => onSend(p)} />
      </div>
      <Footer />
    </div>
  )
}
