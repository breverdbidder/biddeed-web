'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, ArrowUpRight, Copy, Check } from 'lucide-react'
import { useState } from 'react'

import DeedRobotMark from '@/components/deed/DeedRobotMark'
import { countyLabel } from '@/lib/deed/context'
import type { Thread, ThreadTurn } from '@/lib/deed/threads'
import { cn } from '@/lib/utils'
import AuctionCards from './AuctionCards'

/**
 * Markdown via react-markdown. No dangerouslySetInnerHTML here, ever — model
 * output goes through a real parser, never into innerHTML.
 */
function Markdown({ children }: { children: string }) {
  return (
    <div
      className={cn(
        'space-y-3 text-[15px] leading-7 text-foreground',
        '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px]',
        '[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-[15px] [&_h3]:font-semibold',
        '[&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_ul]:space-y-1 [&_ol]:space-y-1',
        '[&_strong]:font-semibold',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        // Tables: scroll inside their own box on narrow screens, never the page.
        '[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-[13px] [&_table]:leading-5',
        '[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold',
        '[&_td]:tabular [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-border/60 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top'
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

function ActionNote({ turn }: { turn: ThreadTurn }) {
  if (!turn.action) return null
  if (turn.action.kind === 'filter_county') {
    const href = `/radar?view=table&county=${encodeURIComponent(turn.action.county)}`
    return (
      <Link
        href={href}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary"
      >
        Open {countyLabel(turn.action.county)} County in Auctions <ArrowUpRight className="size-4" aria-hidden />
      </Link>
    )
  }
  const href = `/radar/${encodeURIComponent(turn.action.auctionId)}`
  return (
    <Link
      href={href}
      className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary"
    >
      Open the auction record <ArrowUpRight className="size-4" aria-hidden />
    </Link>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  if (!text) return null
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* clipboard blocked — nothing to do */
        }
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

/**
 * The upstream chat service returns the whole answer in one chunk and cuts it
 * around 1,500 characters — sometimes mid-sentence, sometimes inside a bold
 * marker. Balance the markdown so no stray ** reaches the screen, and say
 * plainly when an answer looks cut short rather than presenting a fragment as
 * the whole reply.
 */
function tidyAnswer(raw: string, live: boolean): { text: string; truncated: boolean } {
  let text = raw
  const bolds = (text.match(/\*\*/g) || []).length
  if (bolds % 2 === 1) {
    const i = text.lastIndexOf('**')
    text = text.slice(0, i) + text.slice(i + 2)
  }
  const tail = text.trim()
  const truncated =
    !live &&
    tail.length >= 900 &&
    !/[.!?)\]"”»…:]$/.test(tail) &&
    !/\|$/.test(tail)
  return { text, truncated }
}

function AssistantTurn({ turn, streaming }: { turn: ThreadTurn; streaming: string }) {
  const live = turn.pending
  const { text, truncated } = tidyAnswer(live ? streaming : turn.content, Boolean(live))
  return (
    <div className="flex min-w-0 gap-3 sm:gap-4">
      <div className="mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card sm:flex">
        <DeedRobotMark size={22} />
      </div>
      <div className="min-w-0 flex-1 space-y-4">
        {turn.cards ? <AuctionCards set={turn.cards} /> : null}

        {turn.error ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="text-sm text-foreground">{turn.error}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing was lost. Send the message again, or rephrase it if this keeps happening.
              </p>
            </div>
          </div>
        ) : text ? (
          <>
            <Markdown>{text}</Markdown>
            {truncated ? (
              <p className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-secondary-foreground">
                Deed&rsquo;s answer was cut short by the chat service. Ask a follow-up for the rest, or open the sales in
                Auctions.
              </p>
            ) : null}
          </>
        ) : live ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex gap-1" aria-hidden>
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s] motion-reduce:animate-none" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s] motion-reduce:animate-none" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary motion-reduce:animate-none" />
            </span>
            Deed is reading the county records…
          </p>
        ) : !turn.cards ? (
          <p className="text-sm italic text-muted-foreground">Stopped before any answer arrived.</p>
        ) : null}

        <ActionNote turn={turn} />

        {!live && (turn.content || turn.cards) ? (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <CopyButton text={turn.content} />
            <span className="px-2 text-[11px] text-muted-foreground">
              Deed is decision support, not legal, title or financial advice.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ThreadView({ thread, streaming }: { thread: Thread; streaming: string }) {
  const endRef = useRef<HTMLDivElement>(null)
  const lastLen = useRef(0)

  // Follow the conversation as it grows, but only when something new arrived
  // — a customer who scrolled up to re-read a card is not yanked back down.
  useEffect(() => {
    const total = thread.turns.length + streaming.length
    if (total !== lastLen.current) {
      lastLen.current = total
      endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [thread.turns.length, streaming])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-6 pt-6 sm:px-6">
      {thread.turns.map((turn) =>
        turn.role === 'user' ? (
          <div key={turn.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-6 text-secondary-foreground sm:max-w-[75%]">
              <p className="whitespace-pre-wrap">{turn.content}</p>
            </div>
          </div>
        ) : (
          <AssistantTurn key={turn.id} turn={turn} streaming={streaming} />
        )
      )}
      <div ref={endRef} aria-hidden />
    </div>
  )
}
