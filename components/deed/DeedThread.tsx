'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, MapPinned, Paperclip, SquareArrowOutUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import DeedRobotMark from './DeedRobotMark'
import { countyLabel } from '@/lib/deed/context'
import type { DeedTurn } from './useDeedChat'

interface Props {
  turns: DeedTurn[]
  streaming: string
  status: 'idle' | 'streaming' | 'error'
  surface: string
  onSuggestion: (text: string) => void
}

const SUGGESTIONS = [
  'What is selling this week?',
  'Which counties have the most upcoming tax deeds?',
  'Explain the opening bid on the record I have open.',
]

/**
 * Markdown rendering, via react-markdown.
 *
 * There is NO dangerouslySetInnerHTML anywhere in this component and there must
 * never be one. The surface this replaces built assistant messages with
 * `bbl.innerHTML = mdToHtml(fullText)` — a hand-rolled markdown-to-HTML
 * function writing model output straight into the DOM. That is the XSS class of
 * bug the whole assistant-ui migration exists to remove, and it is one careless
 * "just for tables" edit away from coming back.
 *
 * Links are forced to open in a new tab with rel="noreferrer": the model can
 * emit a URL, and a same-tab navigation out of a half-finished bid analysis
 * loses the user's place.
 */
function Markdown({ children }: { children: string }) {
  return (
    <div
      className={cn(
        'space-y-3 text-sm leading-relaxed text-slate-200',
        '[&_a]:text-bd-orange [&_a]:underline [&_a]:underline-offset-2',
        '[&_code]:rounded [&_code]:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs',
        '[&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal',
        '[&_strong]:font-semibold [&_strong]:text-white',
        // Every currency and bid figure in an answer is tabular: numbers that
        // jitter between lines read as amateur in front of an investor.
        '[&_table]:w-full [&_table]:text-xs [&_td]:tabular [&_td]:py-1 [&_th]:py-1 [&_th]:text-left'
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

function ActionNote({ turn }: { turn: DeedTurn }) {
  if (!turn.action) return null
  const label =
    turn.action.kind === 'filter_county'
      ? `Filtered the workspace to ${countyLabel(turn.action.county)}`
      : `Opened auction record ${turn.action.auctionId}`
  const Icon = turn.action.kind === 'filter_county' ? MapPinned : SquareArrowOutUpRight
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </p>
  )
}

export default function DeedThread({ turns, streaming, status, surface, onSuggestion }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [turns.length, streaming])

  if (turns.length === 0 && !streaming) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <DeedRobotMark size={44} decorative={false} className="rounded-xl" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bd-orange">Deed Voice AI</p>
            <h3 className="text-sm font-semibold text-white">Ask about this screen</h3>
          </div>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          Deed is looking at the {surface}. It answers from recorded auction data and cites
          the endpoint or case number behind every figure — and it can filter or open records
          for you.
        </p>
        <ul className="mt-4 space-y-2">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onSuggestion(s)}
                className={cn(
                  'w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5',
                  'text-left text-sm text-slate-300 outline-none transition-colors',
                  'hover:border-slate-700 hover:text-white focus-visible:ring-2 focus-visible:ring-bd-orange'
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-relaxed text-slate-500">
          Deed is not legal, title or financial advice. A Clear to Bid report remains the
          document to rely on before bidding.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
      {turns.map((turn) =>
        turn.role === 'user' ? (
          <div key={turn.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-800 px-3.5 py-2.5">
              {turn.content ? (
                <p className="whitespace-pre-wrap text-sm text-slate-100">{turn.content}</p>
              ) : null}
              {turn.attachments?.length ? (
                <ul className="mt-2 space-y-1">
                  {turn.attachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-1.5 text-xs text-slate-400"
                    >
                      <Paperclip className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{a.name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : (
          <div key={turn.id}>
            {turn.error ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden />
                <div>
                  {/* State what happened and what to do. Never a bare "error". */}
                  <p className="text-sm text-red-200">{turn.error}</p>
                  <p className="mt-1 text-xs text-red-300/70">
                    Nothing was sent to the auction data. Send the message again, or rephrase
                    it if this keeps happening.
                  </p>
                </div>
              </div>
            ) : turn.content ? (
              <>
                <Markdown>{turn.content}</Markdown>
                <ActionNote turn={turn} />
              </>
            ) : (
              <p className="text-xs italic text-slate-500">Stopped before any answer arrived.</p>
            )}
          </div>
        )
      )}

      {streaming ? <Markdown>{streaming}</Markdown> : null}

      {status === 'streaming' && !streaming ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <span className="size-1.5 animate-pulse rounded-full bg-bd-orange motion-reduce:animate-none" />
          Deed is reading the auction data…
        </p>
      ) : null}

      <div ref={endRef} />
    </div>
  )
}
