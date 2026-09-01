import { NextRequest, NextResponse } from 'next/server'
import { requireAlertContext } from '@/lib/alerts/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const fields = 'id,property_ref,label,case_number,county,status,created_at,updated_at'

function validText(value: unknown, max: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null
}

export async function GET() {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401 })
  const { data, error } = await context.supabase.from('property_watchlists').select(fields).eq('customer_id', context.userId).eq('status', 'active').order('updated_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load your watchlist.' }, { status: 502 })
  return NextResponse.json({ watchlist: data ?? [] })
}

export async function POST(request: NextRequest) {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const propertyRef = validText(body?.property_ref, 160)
  const label = validText(body?.label, 160)
  const caseNumber = validText(body?.case_number, 160)
  const county = validText(body?.county, 80)
  const key = request.headers.get('idempotency-key')?.trim()
  if (!propertyRef || !label || !key || key.length > 120) return NextResponse.json({ error: 'Invalid watchlist details.' }, { status: 400 })
  const { data: existing } = await context.supabase.from('property_watchlists').select(fields).eq('customer_id', context.userId).eq('property_ref', propertyRef).eq('status', 'active').limit(1)
  if (existing?.[0]) return NextResponse.json({ item: existing[0], replayed: true })
  const { data, error } = await context.supabase.from('property_watchlists').insert({ customer_id: context.userId, property_ref: propertyRef, label, case_number: caseNumber, county, status: 'active' }).select(fields).single()
  if (error) return NextResponse.json({ error: 'Unable to add this property to your watchlist.' }, { status: 502 })
  return NextResponse.json({ item: data }, { status: 201 })
}
