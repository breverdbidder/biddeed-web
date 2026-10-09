import { parseAuctionIntent } from '@/lib/deed/intent'

/**
 * Reads a plan / billing request out of a customer's message (issue #20664).
 *
 * Deliberately deterministic, not a model call: this decides whether a message
 * may even START a purchase flow, and a model that can be talked into a charge
 * is the failure the confirmation gate exists to prevent. A false negative costs
 * a plain chat answer; a false positive only ever opens a read-back with a
 * Confirm button. Nothing here charges anything.
 */
export type Tier = 'investor' | 'pro' | 'proplus'

export type LifecycleIntent =
  | { kind: 'quote'; tier: Tier | null; interval: 'monthly' | 'annual'; report: boolean }
  | { kind: 'buy'; tier: Tier | null; interval: 'monthly' | 'annual' }
  | { kind: 'buy_report'; county: string | null; caseNumber: string | null }
  | { kind: 'portal' }
  | { kind: 'cancel' }
  | { kind: 'change_plan' }
  | { kind: 'account' }
  | { kind: 'invoices' }
  | { kind: 'affirm' }

const CASE_RE = /\b(\d{2,4}[-\s]?[A-Z]{2}[-\s]?\d{3,7}(?:[-\s]?[A-Z0-9]{2,6})*|\d{4}-\d{3,6}[A-Z]{0,3})\b/

export function readTier(t: string): Tier | null {
  if (/\bpro\s*(\+|plus)|\bproplus\b/i.test(t)) return 'proplus'
  if (/\binvestor\b/i.test(t)) return 'investor'
  if (/\bpro\b(?!\s*(\+|plus))/i.test(t)) return 'pro'
  return null
}

export function readLifecycleIntent(raw: string): LifecycleIntent | null {
  const t = raw.trim()
  if (!t || t.length > 400) return null

  // A bare yes never does anything by itself; it is routed so Deed can point at the button.
  if (/^(yes|yep|yeah|confirm(ed)?|go ahead|do it|ok(ay)?|sure|proceed)[.! ]*$/i.test(t)) return { kind: 'affirm' }

  const interval = /\b(annual|annually|yearly|per year|a year)\b/i.test(t) ? 'annual' : 'monthly'
  const tier = readTier(t)
  const planWords = /\b(plan|plans|subscription|subscribe|membership|pricing|tier|credits)\b/i.test(t)
  const reportWords = /\b(signal\$?\s*(property\s*)?report|property report|the report|a report)\b/i.test(t)

  if (/\bcancel\b/i.test(t) && (planWords || /\b(my|the)\s+(account|membership)\b/i.test(t))) return { kind: 'cancel' }
  if (/\b(downgrade|switch (my )?plan|change (my )?plan|switch to)\b/i.test(t) && (planWords || tier)) return { kind: 'change_plan' }
  if (/\b(invoices?|receipts?|billing history)\b/i.test(t)) return { kind: 'invoices' }
  if (/\b(payment method|update (my )?card|billing (page|portal|settings)|manage (my )?(billing|subscription|plan))\b/i.test(t)) return { kind: 'portal' }
  if (/\b(what plan am i on|my (plan|subscription|account)\b|am i subscribed|account status)/i.test(t)) return { kind: 'account' }

  if (/\b(buy|purchase|order|get me|i want|i'd like|i would like)\b/i.test(t) && reportWords) {
    const auction = parseAuctionIntent(t)
    return { kind: 'buy_report', county: auction?.county ?? null, caseNumber: t.match(CASE_RE)?.[1]?.replace(/\s+/g, '-') ?? null }
  }
  if (/\b(buy|subscribe|sign me up|upgrade|start|purchase|get)\b/i.test(t) && (planWords || tier)) return { kind: 'buy', tier, interval }
  if (/\b(how much|price|pricing|cost|quote|what does .* cost)\b/i.test(t) && (planWords || tier || reportWords)) {
    return { kind: 'quote', tier, interval, report: reportWords && !tier }
  }
  return null
}
