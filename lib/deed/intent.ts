import { FL_COUNTIES } from '@/lib/counties'

/**
 * Reads an auction-browse intent out of a customer's message so the thread can
 * answer with rows, not prose.
 *
 * This is deliberately a small, transparent parser rather than a model call:
 * it runs in the browser before the request leaves the page, costs nothing, and
 * when it fires the cards it produces come from /api/auctions — the same rows
 * the workspace shows. The model still answers in words beside them; it just
 * never has to type a table that the Worker will truncate mid-row.
 *
 * When nothing matches, `null` is returned and the turn is text-only. A false
 * negative costs a card grid; a false positive costs a wrong card grid — so the
 * county / sale-type / timeframe signals below are all explicit words, never
 * inferred.
 */
export interface AuctionIntent {
  /** DB slug (underscore form), e.g. 'palm_beach'. */
  county: string | null
  /** Human label for the county, e.g. 'Palm Beach'. */
  countyName: string | null
  saleType: 'foreclosure' | 'tax_deed' | null
  /** ISO dates, inclusive. `from` is today when a window is named. */
  from: string | null
  to: string | null
  /** e.g. "under $50k" → 50000. Applied to opening_bid client-side. */
  maxOpeningBid: number | null
  /** Human phrase for the window, e.g. 'this week', or null when none was named. */
  when: string | null
  /** What the grid header should say. */
  label: string
}

const BROWSE_WORDS =
  /\b(auction|auctions|sales?|selling|sells|upcoming|calendar|what'?s coming|coming up|show me|show|find|search|list|listings?|lots|deals|properties|inventory|scheduled)\b/i

/**
 * Questions ABOUT auctions rather than FOR auctions. "Which liens survive a
 * tax deed sale?" names a sale type but wants an explanation, not a card grid.
 * Any of these with no county and no time window means: text answer only.
 */
const KNOWLEDGE_WORDS =
  /\b(what is|what's|what are|what does|how does|how do|how is|how are|explain|why|which liens?|survive|survives|difference|differences|mean|means|meaning|definition|define|work|works|calculated|calculate|should i|can i|do i|is it|are there any risks|risk|risks|tips|guide|first[- ]time)\b/i

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

function parseMoney(text: string): number | null {
  // "under $50k", "below 100,000", "less than $1.2m", "max 75k"
  const m = /\b(?:under|below|less than|max(?:imum)?|up to|cheaper than)\s*\$?\s*([\d.,]+)\s*(k|m)?\b/i.exec(text)
  if (!m) return null
  let n = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  if (m[2]?.toLowerCase() === 'k') n *= 1_000
  if (m[2]?.toLowerCase() === 'm') n *= 1_000_000
  return n > 0 ? Math.round(n) : null
}

export function parseAuctionIntent(text: string, now: Date = new Date()): AuctionIntent | null {
  const t = text.trim()
  if (!t) return null

  // County: longest name first so "Palm Beach" wins over a stray "Beach".
  let county: string | null = null
  let countyName: string | null = null
  const sorted = [...FL_COUNTIES].sort((a, b) => b.name.length - a.name.length)
  for (const c of sorted) {
    const re = new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+')}\\b`, 'i')
    if (re.test(t)) {
      county = c.slug.replace(/-/g, '_')
      countyName = c.name
      break
    }
  }

  let saleType: AuctionIntent['saleType'] = null
  if (/\btax[\s-]?deeds?\b/i.test(t)) saleType = 'tax_deed'
  else if (/\bforeclos/i.test(t)) saleType = 'foreclosure'

  let from: string | null = null
  let to: string | null = null
  let when = ''
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (/\btoday\b/i.test(t)) {
    from = to = isoDate(today)
    when = 'today'
  } else if (/\btomorrow\b/i.test(t)) {
    from = to = isoDate(addDays(today, 1))
    when = 'tomorrow'
  } else if (/\bthis week\b|\bnext (?:7|seven) days\b/i.test(t)) {
    from = isoDate(today)
    to = isoDate(addDays(today, 7))
    when = 'this week'
  } else if (/\bnext week\b/i.test(t)) {
    from = isoDate(addDays(today, 7))
    to = isoDate(addDays(today, 14))
    when = 'next week'
  } else if (/\bthis month\b/i.test(t)) {
    from = isoDate(today)
    to = isoDate(endOfMonth(today))
    when = 'this month'
  } else if (/\bnext (?:30|thirty) days\b|\bnext month\b/i.test(t)) {
    from = isoDate(today)
    to = isoDate(addDays(today, 30))
    when = 'in the next 30 days'
  }

  const maxOpeningBid = parseMoney(t)

  // Fire only when the message is actually about browsing inventory: it must
  // name a place or a time, or use a browse word — a sale type on its own is
  // not enough ("what is a tax deed?" is a question, not a search).
  const browsing = BROWSE_WORDS.test(t) || Boolean(county) || Boolean(when)
  if (!browsing) return null
  // Explanatory questions with no anchor in place or time get a text answer.
  if (!county && !when && KNOWLEDGE_WORDS.test(t)) return null
  // A bare browse word with nothing else ("show me") is too vague to answer
  // with rows, and would return the whole state.
  if (!county && !saleType && !when && !maxOpeningBid && !/\b(auction|auctions|upcoming|selling|sales?|coming up|what'?s coming)\b/i.test(t)) {
    return null
  }

  const typeLabel = saleType === 'tax_deed' ? 'tax deed' : saleType === 'foreclosure' ? 'foreclosure' : ''
  const parts = ['Upcoming', typeLabel, 'auctions']
  if (countyName) parts.push(`in ${countyName} County`)
  if (when) parts.push(when)
  if (maxOpeningBid) parts.push(`· opening bid under $${maxOpeningBid.toLocaleString('en-US')}`)

  return {
    county,
    countyName,
    saleType,
    from,
    to,
    maxOpeningBid,
    when: when || null,
    label: parts.filter(Boolean).join(' ').replace(/\s+/g, ' '),
  }
}

/** Builds the /api/auctions query for an intent. Always upcoming-only. */
export function intentToQuery(intent: AuctionIntent, limit = 6): string {
  const q = new URLSearchParams()
  q.set('upcoming', 'true')
  q.set('limit', String(limit))
  q.set('order', 'asc')
  if (intent.county) q.set('county', intent.county)
  if (intent.saleType) q.set('sale_type', intent.saleType)
  if (intent.from) q.set('from', intent.from)
  if (intent.to) q.set('to', intent.to)
  return `/api/auctions?${q.toString()}`
}

/** The /radar link that shows the same rows in the full workspace. */
export function intentToRadarHref(intent: AuctionIntent): string {
  const q = new URLSearchParams()
  q.set('view', 'table')
  if (intent.county) q.set('county', intent.county)
  if (intent.saleType) q.set('sale_type', intent.saleType)
  return `/radar?${q.toString()}`
}
