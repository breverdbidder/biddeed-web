import { NextRequest, NextResponse } from 'next/server'
import { requireAlertContext } from '@/lib/alerts/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const selectFields = 'id,name,query,status,created_at,updated_at'

function parseInput(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const query = body.query
  if (!name || name.length > 120 || !query || typeof query !== 'object' || Array.isArray(query)) return null
  const serialized = JSON.stringify(query)
  if (serialized.length > 10000) return null
  return { name, query }
}

export async function GET() {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401 })
  const { data, error } = await context.supabase.from('saved_searches').select(selectFields).eq('customer_id', context.userId).neq('status', 'archived').order('updated_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load saved searches.' }, { status: 502 })
  return NextResponse.json({ searches: data ?? [] })
}

export async function POST(request: NextRequest) {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401 })
  const input = parseInput(await request.json().catch(() => null))
  if (!input) return NextResponse.json({ error: 'Invalid saved-search details.' }, { status: 400 })
  const key = request.headers.get('idempotency-key')?.trim()
  if (!key || key.length > 120) return NextResponse.json({ error: 'Missing idempotency key.' }, { status: 400 })
  const { data: existing } = await context.supabase.from('saved_searches').select(selectFields).eq('customer_id', context.userId).eq('name', input.name).eq('status', 'active').limit(1)
  if (existing?.[0]) return NextResponse.json({ search: existing[0], replayed: true })
  const { data, error } = await context.supabase.from('saved_searches').insert({ customer_id: context.userId, name: input.name, query: input.query, status: 'active' }).select(selectFields).single()
  if (error) return NextResponse.json({ error: 'Unable to save this search.' }, { status: 502 })
  return NextResponse.json({ search: data }, { status: 201 })
}
