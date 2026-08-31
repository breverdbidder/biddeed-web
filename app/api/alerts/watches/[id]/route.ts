import { NextRequest, NextResponse } from 'next/server'
import { publicWatch, requireAlertContext } from '@/lib/alerts/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const selectFields = 'id,case_number,county,alert_types,max_bid,status,created_at'

function watchId(value: string) {
  return /^\d+$/.test(value) ? value : null
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authContext = await requireAlertContext()
  if (authContext.error || !authContext.supabase || !authContext.userId) return NextResponse.json({ error: authContext.error }, { status: 401 })
  const id = watchId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Invalid alert identifier.' }, { status: 400 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const status = body?.status
  if (status !== 'active' && status !== 'paused') return NextResponse.json({ error: 'Invalid alert status.' }, { status: 400 })
  const { data, error } = await authContext.supabase.from('auction_watches').update({ status }).eq('id', id).eq('customer_id', authContext.userId).neq('status', 'cancelled').select(selectFields).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to update this alert.' }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'Alert not found.' }, { status: 404 })
  return NextResponse.json({ watch: publicWatch(data as Record<string, unknown>) })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authContext = await requireAlertContext()
  if (authContext.error || !authContext.supabase || !authContext.userId) return NextResponse.json({ error: authContext.error }, { status: 401 })
  const id = watchId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Invalid alert identifier.' }, { status: 400 })
  const { data, error } = await authContext.supabase.from('auction_watches').update({ status: 'cancelled' }).eq('id', id).eq('customer_id', authContext.userId).neq('status', 'cancelled').select(selectFields).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to cancel this alert.' }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'Alert not found.' }, { status: 404 })
  return NextResponse.json({ watch: publicWatch(data as Record<string, unknown>) })
}
