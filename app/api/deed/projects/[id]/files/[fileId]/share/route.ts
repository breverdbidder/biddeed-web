import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { FILE_ID_RE, PROJECT_ID_RE, SHARE_FIELDS, newShareToken, type ShareRow } from '@/lib/deed/projects'
import { dbErrorResponse, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Share link for one stored file version (PARITY CP-4 PR B, #19847 DoD 3).
 *   POST   …/files/:fileId/share   mint (or return the active) token → {token, url}
 *   DELETE …/files/:fileId/share   revoke → /projects/shared/{token} answers 404 from now on
 * The public URL carries the token only — no project id, file id or identity.
 * 401 signed out · 404 unless the caller owns the file · 503 until the PR B
 * migration adds the share columns.
 */

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

function shareUrl(req: NextRequest, token: string): string {
  const origin = new URL(req.url).origin
  return `${origin}/projects/shared/${token}`
}

async function ownedFile(supabase: SupabaseClient, userId: string, projectId: string, fileId: string) {
  return supabase.from('deed_project_files').select(SHARE_FIELDS).eq('project_id', projectId).eq('owner_user_id', userId).eq('id', fileId).maybeSingle<ShareRow>()
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id, fileId } = await ctx.params
  if (!PROJECT_ID_RE.test(id) || !FILE_ID_RE.test(fileId)) return notFound()

  const { data: file, error } = await ownedFile(supabase, userId, id, fileId)
  if (error) return dbErrorResponse(error, 'Unable to share this file.')
  if (!file) return notFound()

  if (file.share_token && !file.share_revoked_at) {
    return NextResponse.json({ token: file.share_token, url: shareUrl(req, file.share_token), shared_at: file.shared_at, views: file.share_views ?? 0, existing: true })
  }
  const token = newShareToken()
  const shared_at = new Date().toISOString()
  const { data, error: updError } = await supabase
    .from('deed_project_files')
    .update({ share_token: token, shared_at, share_revoked_at: null, share_views: 0 })
    .eq('id', fileId)
    .eq('owner_user_id', userId)
    .select(SHARE_FIELDS)
    .maybeSingle<ShareRow>()
  if (updError) return dbErrorResponse(updError, 'Unable to share this file.')
  if (!data) return notFound()
  return NextResponse.json({ token, url: shareUrl(req, token), shared_at, views: 0, existing: false }, { status: 201 })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id, fileId } = await ctx.params
  if (!PROJECT_ID_RE.test(id) || !FILE_ID_RE.test(fileId)) return notFound()

  const { data: file, error } = await ownedFile(supabase, userId, id, fileId)
  if (error) return dbErrorResponse(error, 'Unable to revoke this share.')
  if (!file || !file.share_token || file.share_revoked_at) return notFound()

  const revoked_at = new Date().toISOString()
  const { error: updError } = await supabase.from('deed_project_files').update({ share_revoked_at: revoked_at }).eq('id', fileId).eq('owner_user_id', userId)
  if (updError) return dbErrorResponse(updError, 'Unable to revoke this share.')
  return NextResponse.json({ revoked: file.share_token, revoked_at })
}
