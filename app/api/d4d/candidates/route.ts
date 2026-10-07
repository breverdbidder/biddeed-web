import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { requireCapability } from '@/lib/tier/server'
import type { D4DCandidate } from '@/components/d4d/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CANDIDATE_LIMIT = 500

type CandidateRpcRow = {
  mca_id: string
  county: string
  case_number: string
  address: string
  auction_date: string
  lat: number
  lng: number
}

// The RPC uses address/lat/lng; the picker consumes the public candidate contract.
// Keep unsupported enrichment fields null, rather than inventing values.
const toCandidate = (row: CandidateRpcRow): D4DCandidate => ({
  mca_id: row.mca_id,
  county: row.county,
  case_number: row.case_number,
  property_address: row.address,
  auction_date: row.auction_date,
  latitude: row.lat,
  longitude: row.lng,
  zip: null,
  judgment_amount: null,
  opening_bid: null,
  assessed_value: null,
  parity_status: null,
})

// GET /api/d4d/candidates?county=&from=&to= — upcoming lots selectable for a route.
export async function GET(request: NextRequest) {
  const check = await requireCapability('build_d4d_route')
  if (!check.allowed) {
    return NextResponse.json(
      { error: 'D4D route building requires an upgrade.', tierId: check.tierId, upgradeTier: check.upgradeTier, upgradePrice: check.upgradePrice },
      { status: 402 }
    )
  }

  const { searchParams } = new URL(request.url)
  const county = searchParams.get('county')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (value && !ISO_DATE.test(value)) {
      return NextResponse.json({ error: `invalid ${name}: expected YYYY-MM-DD` }, { status: 400 })
    }
  }

  const supabase = getRetryingSupabaseClient(undefined, { retryMode: 'full' })
  const { data, error } = await supabase.rpc('d4d_candidates', {
    p_county: county ? county.toLowerCase() : null,
    p_from: from,
    p_to: to,
    p_limit: CANDIDATE_LIMIT,
  })
  if (error) return NextResponse.json({ error: 'Unable to load candidate lots.' }, { status: 502 })
  return NextResponse.json({ candidates: ((data ?? []) as CandidateRpcRow[]).map(toCandidate) })
}
