import { NextRequest, NextResponse } from 'next/server'

import { extractUploadText } from '@/lib/deed/extract'
import {
  FILES_BUCKET,
  FILE_FIELDS,
  MAX_FILE_BYTES,
  PROJECT_ID_RE,
  ownedProject,
  safeFilename,
  storagePath,
  type ProjectFileRow,
} from '@/lib/deed/projects'
import { dbErrorResponse, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Project files (PARITY CP-4 — "the attachment and download abilities").
 *   GET  /api/deed/projects/:id/files   every file, every version
 *   POST /api/deed/projects/:id/files   {filename, mime_type, data_base64} — up to 20 MB.
 *        The same filename uploaded again becomes the next version; bytes go to
 *        the private artifacts bucket, text is extracted (PDF / TXT / CSV / MD)
 *        so Deed can cite the file in the project's chat. Other types are kept
 *        and downloadable, marked 'unsupported' for citing — never a silent
 *        empty citation.
 */

const MAX_CONTENT_LENGTH = Math.ceil(MAX_FILE_BYTES * 1.4) + 4096

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id } = await ctx.params
  if (!PROJECT_ID_RE.test(id)) return bad(404, 'Not found')

  const { data: project, error } = await ownedProject(supabase, userId, id)
  if (error) return dbErrorResponse(error, 'Unable to load the files.')
  if (!project) return bad(404, 'Not found')

  const { data, error: filesError } = await supabase
    .from('deed_project_files')
    .select(FILE_FIELDS)
    .eq('project_id', id)
    .eq('owner_user_id', userId)
    .order('filename')
    .order('version', { ascending: false })
  if (filesError) return dbErrorResponse(filesError, 'Unable to load the files.')
  return NextResponse.json({ files: (data ?? []) as ProjectFileRow[] })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id } = await ctx.params
  if (!PROJECT_ID_RE.test(id)) return bad(404, 'Not found')

  const cl = parseInt(req.headers.get('content-length') || '0', 10)
  if (cl > MAX_CONTENT_LENGTH) return bad(413, 'File too large (20 MB max)')

  const { data: project, error } = await ownedProject(supabase, userId, id)
  if (error) return dbErrorResponse(error, 'Unable to store this file.')
  if (!project) return bad(404, 'Not found')

  let body: { filename?: unknown; mime_type?: unknown; data_base64?: unknown }
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid request body')
  }
  const filename = typeof body.filename === 'string' ? safeFilename(body.filename) : ''
  if (!filename) return bad(400, 'A file name is required')
  const mimeType = typeof body.mime_type === 'string' && body.mime_type ? body.mime_type.slice(0, 120) : null
  if (typeof body.data_base64 !== 'string' || !body.data_base64) return bad(400, 'File data is required')

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(Buffer.from(body.data_base64, 'base64'))
  } catch {
    return bad(400, 'File data is not valid base64')
  }
  if (bytes.byteLength === 0) return bad(400, 'The file is empty')
  if (bytes.byteLength > MAX_FILE_BYTES) return bad(413, 'File too large (20 MB max)')

  // Next version of this name inside this project.
  const { data: prior } = await supabase
    .from('deed_project_files')
    .select('version')
    .eq('project_id', id)
    .eq('owner_user_id', userId)
    .eq('filename', filename)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>()
  const version = (prior?.version ?? 0) + 1

  const fileId = crypto.randomUUID()
  const path = storagePath(id, fileId, version, filename)
  const { error: putError } = await supabase.storage
    .from(FILES_BUCKET)
    .upload(path, bytes, { contentType: mimeType || 'application/octet-stream', upsert: false })
  if (putError) {
    console.error(JSON.stringify({ level: 'error', scope: 'deed.projects.upload', detail: putError.message, ts: new Date().toISOString() }))
    return bad(502, 'Unable to store this file.')
  }

  const extraction = await extractUploadText(mimeType, filename, bytes)

  const { data, error: insError } = await supabase
    .from('deed_project_files')
    .insert({
      id: fileId,
      project_id: id,
      owner_user_id: userId,
      filename,
      mime_type: mimeType,
      size_bytes: bytes.byteLength,
      version,
      storage_path: path,
      extracted_text: extraction.text,
      extraction_status: extraction.status,
    })
    .select(FILE_FIELDS)
    .single<ProjectFileRow>()
  if (insError) {
    await supabase.storage.from(FILES_BUCKET).remove([path])
    return dbErrorResponse(insError, 'Unable to store this file.')
  }
  await supabase.from('deed_projects').update({ updated_at: new Date().toISOString() }).eq('id', id).eq('owner_user_id', userId)
  return NextResponse.json({ file: data }, { status: 201 })
}
