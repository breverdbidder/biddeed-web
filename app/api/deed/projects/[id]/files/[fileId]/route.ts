import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { FILES_BUCKET, FILE_FIELDS, FILE_ID_RE, PROJECT_ID_RE, safeFilename, type ProjectFileRow } from '@/lib/deed/projects'
import { dbErrorResponse, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One project file (PARITY CP-4).
 *   PATCH  …/files/:fileId   {filename} — rename this version's display name
 *   DELETE …/files/:fileId   remove this version (bytes + row)
 * 404 unless the caller owns the project and the file.
 */

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function ownedFile(supabase: SupabaseClient, userId: string, projectId: string, fileId: string) {
  return supabase
    .from('deed_project_files')
    .select(FILE_FIELDS + ',storage_path')
    .eq('project_id', projectId)
    .eq('owner_user_id', userId)
    .eq('id', fileId)
    .maybeSingle<ProjectFileRow & { storage_path: string }>()
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id, fileId } = await ctx.params
  if (!PROJECT_ID_RE.test(id) || !FILE_ID_RE.test(fileId)) return notFound()

  let body: { filename?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const filename = typeof body.filename === 'string' ? safeFilename(body.filename) : ''
  if (!filename) return NextResponse.json({ error: 'A file name is required' }, { status: 400 })

  const { data: file, error } = await ownedFile(supabase, userId, id, fileId)
  if (error) return dbErrorResponse(error, 'Unable to rename this file.')
  if (!file) return notFound()

  const { data, error: updError } = await supabase
    .from('deed_project_files')
    .update({ filename, updated_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('owner_user_id', userId)
    .select(FILE_FIELDS)
    .maybeSingle<ProjectFileRow>()
  if (updError) {
    if (updError.code === '23505') return NextResponse.json({ error: 'A file with that name and version already exists here.' }, { status: 409 })
    return dbErrorResponse(updError, 'Unable to rename this file.')
  }
  if (!data) return notFound()
  return NextResponse.json({ file: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id, fileId } = await ctx.params
  if (!PROJECT_ID_RE.test(id) || !FILE_ID_RE.test(fileId)) return notFound()

  const { data: file, error } = await ownedFile(supabase, userId, id, fileId)
  if (error) return dbErrorResponse(error, 'Unable to delete this file.')
  if (!file) return notFound()

  await supabase.storage.from(FILES_BUCKET).remove([file.storage_path])
  const { data: deleted, error: delError } = await supabase.from('deed_project_files').delete().eq('id', fileId).eq('owner_user_id', userId).select('id')
  if (delError) return dbErrorResponse(delError, 'Unable to delete this file.')
  if (!deleted || deleted.length === 0) return notFound()
  return NextResponse.json({ deleted: fileId })
}
