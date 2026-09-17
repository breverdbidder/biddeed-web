import { NextRequest, NextResponse } from 'next/server'

import { extractUploadText } from '@/lib/deed/extract'
import { dbErrorResponse, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Document upload for a signed-in customer (PARITY CP-3).
 *
 * Replaces the proxy to the Worker's /chat/api/upload, which keyed the row on
 * an email the visitor typed (issue #20226). The file never leaves this app:
 * its text is extracted here (lib/deed/extract.ts, the Worker's own parser
 * ported) and stored under the Clerk `sub`; /api/deed then cites it by id for
 * the same owner. Bytes are not retained — Deed cites text, and files as
 * files are CP-4's Projects layer.
 *
 * Body: { filename, mime_type, data_base64 }  (same contract the composer
 * already sends). 8 MB raw cap, matching the Worker. The row is not tied to a
 * thread at upload time — the thread may not exist yet (it is saved after the
 * first turn); the turn that cites the upload carries its label.
 */

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const MAX_CONTENT_LENGTH = Math.ceil(MAX_UPLOAD_BYTES * 1.4) + 4096
const FILENAME_RE = /^[^\\/]{1,255}$/

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx

  const cl = parseInt(req.headers.get('content-length') || '0', 10)
  if (cl > MAX_CONTENT_LENGTH) return bad(413, 'File too large (8MB max)')

  let body: { filename?: unknown; mime_type?: unknown; data_base64?: unknown }
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid request body')
  }
  const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
  if (!FILENAME_RE.test(filename)) return bad(400, 'A file name is required')
  const mimeType = typeof body.mime_type === 'string' ? body.mime_type.slice(0, 120) : null
  if (typeof body.data_base64 !== 'string' || !body.data_base64) return bad(400, 'File data is required')

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(Buffer.from(body.data_base64, 'base64'))
  } catch {
    return bad(400, 'File data is not valid base64')
  }
  if (bytes.byteLength === 0) return bad(400, 'The file is empty')
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return bad(413, 'File too large (8MB max)')

  const extraction = await extractUploadText(mimeType, filename, bytes)

  const { data, error } = await supabase
    .from('deed_uploads')
    .insert({
      owner_user_id: userId,
      filename,
      mime_type: mimeType,
      size_bytes: bytes.byteLength,
      extracted_text: extraction.text,
      extraction_status: extraction.status,
    })
    .select('id,filename,extraction_status')
    .single()
  if (error) return dbErrorResponse(error, 'Unable to store this upload.')
  return NextResponse.json({ id: data.id, filename: data.filename, extraction_status: data.extraction_status })
}
