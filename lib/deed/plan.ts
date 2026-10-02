import { parseAuctionIntent } from './intent'

/**
 * Deed as orchestrator (Ask Deed). When a message carries buying criteria —
 * a county plus a value floor, a margin target, or "best deals" language —
 * the turn is answered by Deed's plan from mcp.biddeed.ai/deed/ask: the
 * specialist agents (auction, property record, title, rehab, insurance) run
 * on the matching sales, each property is screened against the criteria, and
 * every sellable one carries the $25 SIGNAL$ Property Report checkout.
 *
 * The plan is triage on public figures. Deed has no report format of its
 * own; the deliverable is the one canonical SIGNAL$ Property Report.
 */

export interface DeedPlanCandidate {
  mca_id: string
  case_number: string
  county: string
  county_label: string | null
  property_address: string | null
  city: string | null
  zip: string | null
  auction_date: string | null
  sale_type: string | null
  opening_bid: number | null
  judgment_amount: number | null
  deposit_required: number | null
  property:
    | { matched: true; just_value: number | null; use_code: string | null; living_area_sqft: number | null; year_built: number | null }
    | { matched: false; reason?: string }
  title: { searched: boolean; instruments_on_file?: number; as_of?: string | null; note?: string }
  rehab: { priced: boolean; low?: number | null; mid?: number | null; high?: number | null; note?: string }
  insurance: { premium_annual: number | null; geography?: string | null; scaled?: boolean; note?: string }
  screen: {
    status: 'pass' | 'fail' | 'screened' | 'unscreened'
    /** Warnings the margin cannot capture (junior-lien foreclosure, rehab not priced). */
    flags?: string[]
    value: number | null
    value_basis: string | null
    entry_price: number | null
    entry_basis: string | null
    rehab_mid: number | null
    rehab_basis: string
    margin_pct: number | null
    checks: { test: string; pass: boolean | null }[]
  }
  offer: {
    product: string
    sections: number
    price_usd: number
    sellable: boolean | null
    checkout_url: string | null
    reason?: string
  }
}

export interface DeedPlanStep {
  agent: string
  tool: string
  ok: boolean
  ms: number
  error?: string
  mca_id?: string
}

export interface DeedPlanResult {
  agent: 'Deed'
  status: 'ok' | 'needs_county' | 'no_auctions' | 'error'
  message?: string
  summary?: string
  intent: { label: string; county: string | null; county_label: string | null; when: string; min_value: number | null; target_margin_pct: number | null }
  report: { product: string; sections: number; price_usd: number }
  screen_note: string
  specialists: string[]
  deferred: { agent: string; reason: string }[]
  widened?: boolean
  live?: number
  evaluated?: number
  matched?: number | null
  sellable?: number
  /** What the storefront sells today: whether this county, and which counties do. */
  storefront?: { county_sells_reports: boolean | null; counties: { county: string; county_label: string; upcoming: number | null; next_auction_date: string | null }[] | null }
  next_step?: string
  candidates: DeedPlanCandidate[]
  steps: DeedPlanStep[]
}

export interface PlanSet {
  /** The customer's words — what is re-asked when a saved thread is reopened. */
  query: string
  loading: boolean
  plan?: DeedPlanResult
  error?: string
}

const CRITERIA_WORDS =
  /\b(arv|after[\s-]repair|margin|profit|spread|equity|roi|return|flip|best|top\s+\d+|\d+\s+best|opportunit(?:y|ies)|underwrit\w*|analy[sz]e|screen|worth|value[ds]?\s+(?:over|above|at least)|at\s+least\s+\$)/i

/**
 * True when the message asks Deed to find and judge deals, not just list
 * sales: it must name a county (Deed works one county at a time) and carry a
 * criterion. "Brevard auctions this week" stays a plain card grid.
 */
export function wantsDeedPlan(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 2000) return false
  const intent = parseAuctionIntent(t)
  if (!intent?.county) return false
  return CRITERIA_WORDS.test(t) || /%/.test(t)
}

/** Keeps a storefront link on this origin (biddeed.ai serves /buy-report itself). */
export function sameOriginHref(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname === 'biddeed.ai' || u.hostname === 'www.biddeed.ai') return `${u.pathname}${u.search}`
    return null
  } catch {
    return url.startsWith('/') ? url : null
  }
}
