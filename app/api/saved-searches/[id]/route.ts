import { NextRequest, NextResponse } from 'next/server'
import { requireAlertContext } from '@/lib/alerts/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const selectFields = 'id,name,query,status,created_at,updated_at'

function validId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authContext = await requireAlertContext()
  if (authContext.error || !authContext.supabase || !authContext.userId) return NextResponse.json({ error: authContext.error }, { status: 401 })
  const id = validId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Invalid saved-search identifier.' }, { status: 400 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const name = typeof body?.name === 'string' ? body.name.trim() : undefined
  const query = body?.query
  const status = body?.status
  if (name !== undefined && (!name || name.length > 120)) return NextResponse.json({ error: 'Invalid saved-search name.' }, { status: 400 })
  if (query !== undefined && (!query || typeof query !== 'object' || Array.isArray(query) || JSON.stringify(query).length > 10000)) return NextResponse.json({ error: 'Invalid saved-search criteria.' }, { status: 400 })
  if (status !== undefined && status !== 'active' && status !== 'paused' && status !== 'archived') return NextResponse.json({ error: 'Invalid saved-search status.' }, { status: 400 })
  if (name === undefined && query === undefined && status === undefined) return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  const patch = { ...(name === undefined ? {} : { name }), ...(query === undefined ? {} : { query }), ...(status === undefined ? {} : { status }), updated_at: new Date().toISOString() }
  const { data, error } = await authContext.supabase.from('saved_searches').update(patch).eq('id', id).eq('customer_id', authContext.userId).select(selectFields).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to update this saved search.' }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'Saved search not found.' }, { status: 404 })
  return NextResponse.json({ search: data })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authContext = await requireAlertContext()
  if (authContext.error || !authContext.supabase || !authContext.userId) return NextResponse.json({ error: authContext.error }, { status: 401 })
  const id = validId((await context.params).id)
  if (!id) return NextResponse.json({ error: 'Invalid saved-search identifier.' }, { status: 400 })
  const { data, error } = await authContext.supabase.from('saved_searches').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', id).eq('customer_id', authContext.userId).select(selectFields).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to archive this saved search.' }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'Saved search not found.' }, { status: 404 })
  return NextResponse.json({ search: data })
}
