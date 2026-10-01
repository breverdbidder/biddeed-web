/**
 * Query-string prefill for /parcel (the Parcel underwriting desk).
 *
 * A map pin card or a link can open the desk with an auction's public facts:
 * /parcel?mca_id=<uuid>&county=duval&address=...&opening_bid=2584&assessed=27632
 * Every value is re-validated here (the URL is visitor-controlled): numbers
 * must be finite, non-negative and under a sane cap, text is trimmed and
 * length-capped, the auction id must be a uuid. Anything else is dropped, so
 * the desk opens blank rather than with a wrong figure.
 *
 * No imports, so scripts/validate-parcel.mts runs it under plain node.
 */
export type ParcelPrefill = {
  mcaId: string | null
  county: string
  address: string
  caseNumber: string
  auctionDate: string
  saleType: 'tax_deed' | 'foreclosure' | null
  openingBid: number
  assessedValue: number
  arv: number
  rehab: number
  rentMonthly: number
  taxesAnnual: number
  insuranceAnnual: number
}

export const EMPTY_PREFILL: ParcelPrefill = {
  mcaId: null,
  county: '',
  address: '',
  caseNumber: '',
  auctionDate: '',
  saleType: null,
  openingBid: 0,
  assessedValue: 0,
  arv: 0,
  rehab: 0,
  rentMonthly: 0,
  taxesAnnual: 0,
  insuranceAnnual: 0,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const MAX_DOLLARS = 50_000_000

type Params = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? '').trim()
}

function dollars(v: string | string[] | undefined): number {
  const raw = first(v).replace(/[$,\s]/g, '')
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= MAX_DOLLARS ? Math.round(n) : 0
}

function text(v: string | string[] | undefined, max: number): string {
  return first(v).replace(/[\u0000-\u001f<>]/g, '').slice(0, max)
}

export function parsePrefill(params: Params): ParcelPrefill {
  const mca = first(params.mca_id)
  const county = text(params.county, 40).toLowerCase().replace(/[^a-z_ -]/g, '').replace(/[\s-]+/g, '_')
  const date = first(params.date).slice(0, 10)
  const sale = first(params.sale_type)
  return {
    mcaId: UUID.test(mca) ? mca.toLowerCase() : null,
    county,
    address: text(params.address, 120),
    caseNumber: text(params.case, 40),
    auctionDate: ISO_DAY.test(date) ? date : '',
    saleType: sale === 'tax_deed' || sale === 'foreclosure' ? sale : null,
    openingBid: dollars(params.opening_bid),
    assessedValue: dollars(params.assessed),
    arv: dollars(params.arv),
    rehab: dollars(params.rehab),
    rentMonthly: dollars(params.rent),
    taxesAnnual: dollars(params.taxes),
    insuranceAnnual: dollars(params.insurance),
  }
}

/** Whether the desk was opened from a real auction row (vs typed from scratch). */
export function isAuctionPrefill(p: ParcelPrefill): boolean {
  return Boolean(p.mcaId || p.openingBid > 0)
}

/** The /parcel link for one auction: only the public facts the viewer already sees. */
export function parcelLink(a: {
  id: string
  county: string | null
  property_address?: string | null
  auction_date?: string | null
  opening_bid?: number | null
  assessed_value?: number | null
  sale_type?: string | null
}): string {
  const q = new URLSearchParams({ mca_id: a.id })
  if (a.county) q.set('county', a.county.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  if (a.property_address) q.set('address', a.property_address)
  if (a.auction_date) q.set('date', String(a.auction_date).slice(0, 10))
  if (a.sale_type === 'tax_deed' || a.sale_type === 'foreclosure') q.set('sale_type', a.sale_type)
  if (a.opening_bid && a.opening_bid > 0) q.set('opening_bid', String(Math.round(a.opening_bid)))
  if (a.assessed_value && a.assessed_value > 0) q.set('assessed', String(Math.round(a.assessed_value)))
  return `/parcel?${q.toString()}`
}

/**
 * The /parcel URL for a prefill, carrying only the auction's public facts
 * (never the visitor's own ARV, rehab, rent, taxes or insurance: those stay
 * in the browser's local draft). Used as the sign-up / sign-in return path.
 */
export function publicParcelHref(p: ParcelPrefill): string {
  const q = new URLSearchParams()
  if (p.mcaId) q.set('mca_id', p.mcaId)
  if (p.county) q.set('county', p.county)
  if (p.address) q.set('address', p.address)
  if (p.caseNumber) q.set('case', p.caseNumber)
  if (p.auctionDate) q.set('date', p.auctionDate)
  if (p.saleType) q.set('sale_type', p.saleType)
  if (p.openingBid > 0) q.set('opening_bid', String(p.openingBid))
  if (p.assessedValue > 0) q.set('assessed', String(p.assessedValue))
  const s = q.toString()
  return s ? `/parcel?${s}` : '/parcel'
}

/**
 * The only post-auth destinations the sign-in / sign-up pages honour from
 * `redirect_url` for their own hand-off: the path is always exactly /parcel,
 * and the query is re-parsed and rebuilt from the clean public prefill, so no
 * other host, path or parameter can pass through (no open redirect, no
 * visitor numbers in the URL). Anything else returns null and the pages keep
 * their default destination.
 */
export function safeParcelReturn(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length > 800) return null
  let v = value.trim()
  if (/^https:\/\/biddeed\.ai\//i.test(v)) v = v.slice('https://biddeed.ai'.length)
  if (v === '/parcel') return '/parcel'
  if (!v.startsWith('/parcel?')) return null
  const params: Record<string, string> = {}
  new URLSearchParams(v.slice('/parcel?'.length)).forEach((val, key) => {
    if (!(key in params)) params[key] = val
  })
  return publicParcelHref(parsePrefill(params))
}
