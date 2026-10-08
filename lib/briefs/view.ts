import type { BriefBrand } from './types.ts'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** Money in whole dollars; a missing value is an em dash, never $0. */
export function money(n: unknown): string {
  return typeof n === 'number' && Number.isFinite(n) ? usd.format(n) : '—'
}

export function pct(n: unknown, digits = 1): string {
  return typeof n === 'number' && Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : '—'
}

export function ratio(n: unknown): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '—'
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export const STRATEGY_LABEL: Record<string, string> = {
  str: 'Short-term rental',
  mtr_ensuite: 'Mid-term rental, en-suite conversion',
  brrr_hold: 'Buy, rehab, rent, refinance, hold',
  flip: 'Flip',
}

export const countyLabel = (slug: string) => slug.replace(/_/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase())

export const DEFAULT_BRAND: BriefBrand = { name: 'BidDeed.AI', logo_url: null, license_no: null, primary_color: null, white_label: false }

/** Logo must be https on our own origin or Supabase storage (the page CSP allows only those). */
export function safeLogoUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    return u.hostname === 'biddeed.ai' || u.hostname.endsWith('.supabase.co') ? u.toString() : null
  } catch {
    return null
  }
}

export function safeColor(c: unknown): string | null {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : null
}

export function brandFromOrg(org: Record<string, unknown> | null | undefined): BriefBrand {
  if (!org || typeof org.name !== 'string' || !org.name.trim()) return DEFAULT_BRAND
  return {
    name: org.name.trim().slice(0, 80),
    logo_url: safeLogoUrl(org.logo_url),
    license_no: typeof org.license_no === 'string' ? org.license_no.trim().slice(0, 40) || null : null,
    primary_color: safeColor(org.primary_color),
    white_label: true,
  }
}

/**
 * M3: a rendered brief names no internal vendor, tool, issue number or table.
 * The runner already emits public-record source names; this is the belt to that brace,
 * run over the text of every brief before it is saved or shown.
 */
const INTERNAL = [/\bsupabase\b/i, /\bfirecrawl\b/i, /\bbright\s?data\b/i, /\btracerfy\b/i, /\bskip[- ]?trace/i, /\bsummitleads\b/i, /\bgithub\b/i, /#\d{4,6}\b/, /\bmulti_county_auctions\b/i, /\bgold_standard/i, /\bS5\b/]
export function internalLeaks(text: string): string[] {
  return INTERNAL.filter((re) => re.test(text)).map((re) => re.source)
}
