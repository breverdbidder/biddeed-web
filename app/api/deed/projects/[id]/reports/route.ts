import { NextRequest, NextResponse } from 'next/server'

import { FILES_BUCKET, FILE_FIELDS, PROJECT_ID_RE, ownedProject, storagePath, type ProjectFileRow } from '@/lib/deed/projects'
import { REPORT_FILENAME, REPORT_FORMATS, REPORT_MIME, collectProjectReport, renderReport, type ReportFormat } from '@/lib/deed/reports'
import { dbErrorResponse, deedEmail, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Generated project reports (PARITY CP-4 PR B).
 *   GET  /api/deed/projects/:id/reports   every generated report, newest first
 *   POST /api/deed/projects/:id/reports   {format: 'json' | 'csv' | 'pdf'} —
 *        snapshots the project (facts, the sale from the auctions SSOT, files,
 *        items, what Deed said in each chat, SIGNAL$ disclosure state) into a
 *        real file: JSON, CSV, or a PDF rendered here. Stored as a versioned
 *        project file ("Project report.pdf" v1, v2, …) so the existing
 *        download, share and cite rules apply, and referenced from
 *        deed_project_items as kind 'report'.
 * 401 signed out · 404 for another account's project · 503 until the CP-4
 * migration is applied.
 */

const CITEABLE_CHARS = 20_000

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
  if (error) return dbErrorResponse(error, 'Unable to load the reports.')
  if (!project) return bad(404, 'Not found')

  const { data, error: filesError } = await supabase
    .from('deed_project_files')
    .select(FILE_FIELDS)
    .eq('project_id', id)
    .eq('owner_user_id', userId)
    .in('filename', Object.values(REPORT_FILENAME))
    .order('created_at', { ascending: false })
  if (filesError) return dbErrorResponse(filesError, 'Unable to load the reports.')
  return NextResponse.json({ reports: (data ?? []) as ProjectFileRow[] })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id } = await ctx.params
  if (!PROJECT_ID_RE.test(id)) return bad(404, 'Not found')

  let body: { format?: unknown }
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid request body')
  }
  const format = typeof body.format === 'string' && (REPORT_FORMATS as string[]).includes(body.format) ? (body.format as ReportFormat) : null
  if (!format) return bad(400, 'format must be json, csv or pdf')

  const { data: project, error } = await ownedProject(supabase, userId, id)
  if (error) return dbErrorResponse(error, 'Unable to generate the report.')
  if (!project) return bad(404, 'Not found')

  const email = await deedEmail()
  const data = await collectProjectReport(supabase, userId, email, project)
  const { bytes, text } = renderReport(format, data)
  const filename = REPORT_FILENAME[format]

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
  const { error: putError } = await supabase.storage.from(FILES_BUCKET).upload(path, bytes, { contentType: REPORT_MIME[format], upsert: false })
  if (putError) {
    console.error(JSON.stringify({ level: 'error', scope: 'deed.projects.report', detail: putError.message, ts: new Date().toISOString() }))
    return bad(502, 'Unable to store the report.')
  }

  const { data: file, error: insError } = await supabase
    .from('deed_project_files')
    .insert({
      id: fileId,
      project_id: id,
      owner_user_id: userId,
      filename,
      mime_type: REPORT_MIME[format],
      size_bytes: bytes.byteLength,
      version,
      storage_path: path,
      extracted_text: text.slice(0, CITEABLE_CHARS),
      extraction_status: 'ok',
    })
    .select(FILE_FIELDS)
    .single<ProjectFileRow>()
  if (insError) {
    await supabase.storage.from(FILES_BUCKET).remove([path])
    return dbErrorResponse(insError, 'Unable to store the report.')
  }

  const label = `Project report v${version} (${format.toUpperCase()})`
  const { data: item } = await supabase
    .from('deed_project_items')
    .insert({ project_id: id, owner_user_id: userId, kind: 'report', ref_id: fileId, label })
    .select('id,kind,ref_id,label,added_at')
    .single()
  await supabase.from('deed_projects').update({ updated_at: new Date().toISOString() }).eq('id', id).eq('owner_user_id', userId)

  return NextResponse.json({ file, item: item ?? null, format, sections: data.signal_report.sections.length, unlocked: data.signal_report.unlocked }, { status: 201 })
}
