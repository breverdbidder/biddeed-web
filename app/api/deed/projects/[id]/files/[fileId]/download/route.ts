import { NextRequest, NextResponse } from 'next/server'

import { FILES_BUCKET, FILE_ID_RE, PROJECT_ID_RE, SIGNED_URL_SECONDS } from '@/lib/deed/projects'
import { dbErrorResponse, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/deed/projects/:id/files/:fileId/download
 *
 * A 10-minute signed URL for the bytes in the private artifacts bucket,
 * minted only for the owner (404 for anyone else). The URL itself carries
 * the download disposition with the customer's own file name, so the browser
 * saves "deed.pdf", not the storage key.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id, fileId } = await ctx.params
  if (!PROJECT_ID_RE.test(id) || !FILE_ID_RE.test(fileId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: file, error } = await supabase
    .from('deed_project_files')
    .select('id,filename,mime_type,size_bytes,version,storage_path')
    .eq('project_id', id)
    .eq('owner_user_id', userId)
    .eq('id', fileId)
    .maybeSingle<{ id: string; filename: string; mime_type: string | null; size_bytes: number; version: number; storage_path: string }>()
  if (error) return dbErrorResponse(error, 'Unable to prepare the download.')
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error: signError } = await supabase.storage
    .from(FILES_BUCKET)
    .createSignedUrl(file.storage_path, SIGNED_URL_SECONDS, { download: file.filename })
  if (signError || !data?.signedUrl) {
    console.error(JSON.stringify({ level: 'error', scope: 'deed.projects.download', detail: signError?.message, ts: new Date().toISOString() }))
    return NextResponse.json({ error: 'Unable to prepare the download.' }, { status: 502 })
  }
  return NextResponse.json(
    {
      url: data.signedUrl,
      expires_at: new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString(),
      filename: file.filename,
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
      version: file.version,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
