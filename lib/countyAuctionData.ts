import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}

export interface CountyAuctionData {
  county: string
  rangeFrom: string
  rangeTo: string
  foreclosureUpcoming: number
  taxDeedUpcoming: number
  otherUpcoming: number
  totalUpcoming: number
  nextForeclosureDate: string | null
  nextTaxDeedDate: string | null
  nextAnyDate: string | null
  generatedAt: string
}

const EMPTY: Omit<CountyAuctionData, 'county' | 'rangeFrom' | 'rangeTo' | 'generatedAt'> = {
  foreclosureUpcoming: 0,
  taxDeedUpcoming: 0,
  otherUpcoming: 0,
  totalUpcoming: 0,
  nextForeclosureDate: null,
  nextTaxDeedDate: null,
  nextAnyDate: null,
}

/**
 * Live, server-side per-county auction counts for the /counties pages.
 * Backed by public.auctions_calendar_counts -- the same SSOT RPC
 * app/api/auctions/calendar/route.ts calls -- so these pages can never
 * report a number the calendar/API disagree with. Called from React server
 * components (no 'use client'), so the figures are in the HTML the server
 * sends, not fetched after hydration.
 */
export async function getCountyAuctionData(countySlug: string): Promise<CountyAuctionData> {
  const from = new Date().toISOString().slice(0, 10)
  const toDate = new Date()
  toDate.setUTCDate(toDate.getUTCDate() + 365)
  const to = toDate.toISOString().slice(0, 10)

  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('auctions_calendar_counts', {
    p_from: from,
    p_to: to,
    p_county: countySlug,
    p_sale_type: null,
    p_status_scope: 'live',
  })

  if (error || !data) {
    return { county: countySlug, rangeFrom: from, rangeTo: to, generatedAt: new Date().toISOString(), ...EMPTY }
  }

  type Row = {
    auction_date: string
    foreclosure_count: number
    tax_deed_count: number
    other_count: number
    total: number
  }
  const rows = (data || []) as Row[]

  let foreclosureUpcoming = 0
  let taxDeedUpcoming = 0
  let otherUpcoming = 0
  let totalUpcoming = 0
  let nextForeclosureDate: string | null = null
  let nextTaxDeedDate: string | null = null
  let nextAnyDate: string | null = null

  for (const r of rows) {
    foreclosureUpcoming += Number(r.foreclosure_count) || 0
    taxDeedUpcoming += Number(r.tax_deed_count) || 0
    otherUpcoming += Number(r.other_count) || 0
    totalUpcoming += Number(r.total) || 0
    if (Number(r.foreclosure_count) > 0 && !nextForeclosureDate) nextForeclosureDate = r.auction_date
    if (Number(r.tax_deed_count) > 0 && !nextTaxDeedDate) nextTaxDeedDate = r.auction_date
    if (Number(r.total) > 0 && !nextAnyDate) nextAnyDate = r.auction_date
  }

  return {
    county: countySlug,
    rangeFrom: from,
    rangeTo: to,
    generatedAt: new Date().toISOString(),
    foreclosureUpcoming,
    taxDeedUpcoming,
    otherUpcoming,
    totalUpcoming,
    nextForeclosureDate,
    nextTaxDeedDate,
    nextAnyDate,
  }
}
