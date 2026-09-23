/**
 * Named funnel events for biddeed.ai (issue #181, event contract v1 -
 * docs/analytics/funnel-events.md).
 *
 * Pageviews alone cannot say where a visitor turns into a buyer. These named
 * events can: report_viewed -> checkout_started -> purchase_completed, plus
 * signup_completed and lead_captured (the free-report popup).
 *
 * Privacy boundary, enforced here rather than at every call site:
 * - Nothing is sent when the browser says Do Not Track or Global Privacy
 *   Control, or when the visitor opted out of PostHog capture.
 * - Properties go through sanitizeProps(): only allow-listed keys with short
 *   primitive values survive, and any value that looks like an email, phone
 *   number, token or URL with a query string is dropped. Email, name, address,
 *   payment data and chat text can never ride along on an event.
 *
 * PostHog loads async (PostHogAnalytics injects array.js). Events fired before
 * it finishes loading are queued on window.__bd_ph_q and flushed by the loader
 * right after init, so an early click is not lost.
 */

export const FUNNEL_EVENT_VERSION = 1

export const FUNNEL_EVENTS = [
  'report_viewed',
  'checkout_started',
  'purchase_completed',
  'signup_completed',
  'signup_prompt_clicked',
  'lead_captured',
  'free_report_popup_shown',
  'free_report_popup_dismissed',
] as const

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number]

/** The only property keys an event may carry. */
export const ALLOWED_PROPS = [
  'report_type', // 'sample' | 'paid'
  'product', // 'signal_report' | 'clear_to_bid' | 'pioneer_pro' | 'subscription'
  'plan', // tier id, e.g. 'investor', 'pro_annual'
  'interval', // 'month' | 'year'
  'price_usd', // number
  'currency', // 'usd'
  'surface', // where it happened, e.g. 'free_report_popup', 'buy_report', 'home'
  'path', // pathname only, never a query string
  'trigger', // popup trigger: 'timer' | 'scroll' | 'exit_intent'
  'method', // signup method: 'oauth' | 'email'
  'digest_opt_in', // boolean, lead_captured only
  'stored', // boolean, lead_captured only - did the lead list accept it
  'county', // county slug (public auction data, not the visitor)
  'sale_type', // 'tax_deed' | 'foreclosure'
] as const

type PropValue = string | number | boolean
export type FunnelProps = Partial<Record<(typeof ALLOWED_PROPS)[number], PropValue | null | undefined>>

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const PHONE_RE = /(?:\+?\d[\s().-]?){7,}/
const TOKEN_RE = /\b(?:bd_live_|sk_|pk_|phc_|eyJ)[A-Za-z0-9_-]{6,}/
const QUERY_URL_RE = /\?.+=/

/** Drop anything that is not an allow-listed, short, non-identifying primitive. */
export function sanitizeProps(props: Record<string, unknown> = {}): Record<string, PropValue> {
  const out: Record<string, PropValue> = {}
  for (const key of Object.keys(props)) {
    if (!(ALLOWED_PROPS as readonly string[]).includes(key)) continue
    const v = props[key]
    if (typeof v === 'boolean') {
      out[key] = v
    } else if (typeof v === 'number') {
      if (Number.isFinite(v)) out[key] = v
    } else if (typeof v === 'string') {
      const s = v.trim()
      if (!s || s.length > 80) continue
      if (EMAIL_RE.test(s) || TOKEN_RE.test(s) || QUERY_URL_RE.test(s)) continue
      if (key !== 'path' && PHONE_RE.test(s)) continue
      out[key] = s
    }
  }
  return out
}

type PostHogLike = {
  __loaded?: boolean
  capture?: (event: string, props?: Record<string, unknown>, opts?: Record<string, unknown>) => void
  has_opted_out_capturing?: () => boolean
}

type TrackWindow = typeof globalThis & {
  posthog?: PostHogLike
  __bd_ph_q?: Array<[string, Record<string, unknown>, Record<string, unknown> | undefined]>
  doNotTrack?: string
}

/** False when DNT or GPC is on, or the visitor opted out of PostHog. */
export function trackingAllowed(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as TrackWindow
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string }
  const dnt = nav.doNotTrack ?? w.doNotTrack ?? nav.msDoNotTrack
  if (dnt === '1' || dnt === 'yes') return false
  if (nav.globalPrivacyControl === true) return false
  try {
    if (w.posthog?.has_opted_out_capturing?.()) return false
  } catch {}
  return true
}

/**
 * Fire a named funnel event. Never throws - analytics must not break a page.
 * Pass { beacon: true } right before a full-page navigation (Stripe redirect,
 * report opening) so the event is sent immediately instead of batched.
 */
export function track(event: FunnelEvent, props: FunnelProps = {}, opts: { beacon?: boolean } = {}): void {
  try {
    if (!(FUNNEL_EVENTS as readonly string[]).includes(event)) return
    if (!trackingAllowed()) return
    const w = window as unknown as TrackWindow
    const payload: Record<string, unknown> = {
      ...sanitizeProps({ path: window.location.pathname, ...props }),
      event_version: FUNNEL_EVENT_VERSION,
    }
    const captureOpts = opts.beacon ? { send_instantly: true, transport: 'sendBeacon' } : undefined
    const ph = w.posthog
    if (ph?.__loaded && ph.capture) {
      ph.capture(event, payload, captureOpts)
    } else {
      ;(w.__bd_ph_q = w.__bd_ph_q || []).push([event, payload, captureOpts])
    }
  } catch {}
}

/** Canonical keyless public sample report (Worker SAMPLE_MCA_ID, no key needed). */
export const SAMPLE_REPORT_PATH = '/report/04a30c35-6cef-486d-8599-ce0eb20dd79c'
