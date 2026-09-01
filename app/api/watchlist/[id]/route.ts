import { NextRequest, NextResponse } from 'next/server'
import { requireAlertContext } from '@/lib/alerts/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const fields = 'id,property_ref,label,case_number,county,status,created_at,updated_at'

function validId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authContext = await requireAlertContext()
  if (authContext.error || !authContext.supabase || !authContext.userId) return NextResponse.json({ error: authContext.error }, { status: 401 })
  const id = validId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Invalid watchlist identifier.' }, { status: 400 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const status = body?.status
  if (status !== 'active' && status !== 'archived') return NextResponse.json({ error: 'Invalid watchlist status.' }, { status: 400 })
  const { data, error } = await authContext.supabase.from('property_watchlists').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('customer_id', authContext.userId).select(fields).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to update this watchlist item.' }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'Watchlist item not found.' }, { status: 404 })
  return NextResponse.json({ item: data })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(new NextRequest(request.url, { method: 'PATCH', headers: request.headers, body: JSON.stringify({ status: 'archived' }) }), context)
}
