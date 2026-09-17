import { NextRequest, NextResponse } from 'next/server'

import { THREAD_ID_RE, dbErrorResponse, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One Deed thread (PARITY CP-3).
 *   GET    /api/deed/threads/:id   the full thread (turns included) — 404 unless the caller owns it
 *   DELETE /api/deed/threads/:id   — 404 unless the caller owns it
 *
 * "404, not 403": another customer's id must not confirm that the thread
 * exists. Same convention as /api/saved-searches/:id.
 */

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { id } = await ctx.params
  if (!THREAD_ID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await auth.ctx.supabase
    .from('deed_threads')
    .select('id,title,project_id,worker_conversation_id,turns,created_at,updated_at')
    .eq('owner_user_id', auth.ctx.userId)
    .eq('id', id)
    .maybeSingle()
  if (error) return dbErrorResponse(error, 'Unable to load this chat.')
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ thread: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { id } = await ctx.params
  if (!THREAD_ID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await auth.ctx.supabase
    .from('deed_threads')
    .delete()
    .eq('owner_user_id', auth.ctx.userId)
    .eq('id', id)
    .select('id')
  if (error) return dbErrorResponse(error, 'Unable to delete this chat.')
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: id })
}
