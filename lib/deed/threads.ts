import type { DeedAction } from './protocol'
import type { AuctionIntent } from './intent'

/**
 * Conversation history for the home surface, kept in the browser.
 *
 * This is per-device convenience — the "Recent" list in the sidebar and the
 * ability to reload /?c=<id> without losing a thread — not a system of record.
 * Nothing here is authoritative: every figure inside a turn was fetched from
 * /api/auctions or streamed from the Worker at the time, and the card grid
 * re-fetches when a thread is reopened so stale rows are not shown as current.
 *
 * Every read and write is wrapped: private windows, cleared site data and
 * some embedded browsers throw on access, and the home page must render
 * exactly the same with no history at all.
 */

export interface AuctionCardData {
  id: string
  county: string
  case_number: string
  property_address: string | null
  city: string | null
  zip: string | null
  auction_date: string | null
  sale_type: string | null
  auction_status: string | null
  opening_bid: number | null
  assessed_value: number | null
  judgment_amount: number | null
  property_type: string | null
  photo_url: string | null
}

export interface CardSet {
  intent: AuctionIntent
  rows: AuctionCardData[]
  total: number | null
  /** true while the fetch is in flight; false once settled. */
  loading: boolean
  error?: string
  /**
   * Set when the asked-for window had no live sales and the grid shows the
   * next upcoming sales for the same county / type instead. The header says
   * so; a customer is never shown a fallback as if it were the answer.
   */
  widened?: boolean
  /** The price cap matched nothing priced; the grid shows sales whose opening bid is not yet published. */
  bidUnknown?: boolean
}

export interface ThreadTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  cards?: CardSet
  action?: DeedAction | null
  error?: string
  /** Set while the Worker is still answering this turn. */
  pending?: boolean
  /** Name of the file attached to this (user) turn, if any — display only. */
  attachmentLabel?: string
}

export interface Thread {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  turns: ThreadTurn[]
  /**
   * The Worker's own `biddeed_chat_conversations.id` for this thread, once an
   * identified user's turn has returned one (issue #19829 P1). Reused on the
   * next turn so persistence/search on the Worker side lands in one
   * conversation instead of a new orphan row per message. Absent for
   * anonymous visitors — that is expected, not an error.
   */
  workerConversationId?: string
  /** The project this thread is scoped to (issue #19847 C3), if any. */
  projectId?: string | null
}

const KEY = 'biddeed.deed.threads.v1'
const MAX_THREADS = 30

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 12)
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function loadThreads(): Thread[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isThread).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export function loadThread(id: string): Thread | null {
  return loadThreads().find((t) => t.id === id) ?? null
}

export function saveThread(thread: Thread): void {
  try {
    const rest = loadThreads().filter((t) => t.id !== thread.id)
    // A pending turn is a transport state, never something to reload into.
    const clean: Thread = {
      ...thread,
      turns: thread.turns
        .filter((t) => !t.pending)
        .map((t) => (t.cards ? { ...t, cards: { ...t.cards, loading: false } } : t)),
    }
    const next = [clean, ...rest].slice(0, MAX_THREADS)
    localStorage.setItem(KEY, JSON.stringify(next))
    notify()
  } catch {
    /* storage unavailable — the thread still lives in React state */
  }
}

export function deleteThread(id: string): void {
  try {
    const next = loadThreads().filter((t) => t.id !== id)
    localStorage.setItem(KEY, JSON.stringify(next))
    notify()
  } catch {
    /* ignore */
  }
}

export function clearThreads(): void {
  try {
    localStorage.removeItem(KEY)
    notify()
  } catch {
    /* ignore */
  }
}

/** First user message, trimmed to a sidebar-sized title. */
export function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= 48) return t || 'New conversation'
  return t.slice(0, 47).replace(/\s+\S*$/, '') + '…'
}

function isThread(v: unknown): v is Thread {
  if (!v || typeof v !== 'object') return false
  const t = v as Record<string, unknown>
  return typeof t.id === 'string' && typeof t.title === 'string' && Array.isArray(t.turns)
}

/**
 * Same-tab change notification. `storage` events only fire in OTHER tabs, so
 * the sidebar would never see a thread the page beside it just created.
 */
const EVENT = 'biddeed:threads'
function notify() {
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
}

export function subscribeThreads(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}
