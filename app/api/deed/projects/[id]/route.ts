import { NextRequest, NextResponse } from 'next/server'

import {
  FILES_BUCKET,
  FILE_FIELDS,
  ITEM_FIELDS,
  PROJECT_FIELDS,
  PROJECT_ID_RE,
  activeShares,
  cleanProjectInput,
  ownedProject,
  projectGreeting,
  type ProjectFileRow,
  type ProjectRow,
} from '@/lib/deed/projects'
import { signalReportAccess } from '@/lib/deed/reports'
import { dbErrorResponse, deedEmail, requireDeedContext } from '@/lib/deed/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One project (PARITY CP-4).
 *   GET    /api/deed/projects/:id   the project, its files (every version), its
 *                                    SIGNAL$ disclosure state (S3) and share tokens (PR B),
 *                                   items, its chat threads, and the S1 greeting
 *                                   (what changed since last visit) — then
 *                                   last_viewed_at is touched (S5 last-seen)
 *   PATCH  /api/deed/projects/:id   name, county, case_number, parcel_id, sale_date, notes
 *   DELETE /api/deed/projects/:id   removes the rows (cascade) and the stored bytes;
 *                                   threads that pointed at it keep their text and
 *                                   lose the scope
 *
 * 404, never 403, for another customer's id.
 */

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id } = await ctx.params
  if (!PROJECT_ID_RE.test(id)) return notFound()

  const { data: project, error } = await ownedProject(supabase, userId, id)
  if (error) return dbErrorResponse(error, 'Unable to load this project.')
  if (!project) return notFound()

  const email = await deedEmail()
  const [files, items, threads, greeting, report, shares] = await Promise.all([
    supabase.from('deed_project_files').select(FILE_FIELDS).eq('project_id', id).eq('owner_user_id', userId).order('filename').order('version', { ascending: false }),
    supabase.from('deed_project_items').select(ITEM_FIELDS).eq('project_id', id).eq('owner_user_id', userId).order('added_at', { ascending: false }).limit(50),
    supabase.from('deed_threads').select('id,title,updated_at').eq('owner_user_id', userId).eq('project_id', id).order('updated_at', { ascending: false }).limit(30),
    projectGreeting(supabase, project),
    // S3 (PR B): the 18 SIGNAL$ section names, locked or unlocked for this account.
    signalReportAccess(supabase, email, project),
    // PR B: active share tokens by file id (empty until the share migration).
    activeShares(supabase, userId, id),
  ])

  // S5: this open is the new "last seen"; a sale date the SSOT moved is kept.
  // The peek param lets a client refresh the panel without consuming the
  // greeting window — the greeting is for the customer coming back, not for
  // every re-render.
  const peek = req.nextUrl.searchParams.get('peek') === '1'
  if (!peek) {
    const patch: Record<string, unknown> = { last_viewed_at: new Date().toISOString() }
    if (greeting.sale_date_change) patch.sale_date = greeting.sale_date_change.to
    await supabase.from('deed_projects').update(patch).eq('id', id).eq('owner_user_id', userId)
  }

  return NextResponse.json({
    project: greeting.sale_date_change && !peek ? { ...project, sale_date: greeting.sale_date_change.to } : project,
    files: (files.data ?? []) as ProjectFileRow[],
    items: items.data ?? [],
    threads: threads.data ?? [],
    greeting,
    report,
    shares,
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id } = await ctx.params
  if (!PROJECT_ID_RE.test(id)) return notFound()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = cleanProjectInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { first_touch: _ignored, ...patch } = parsed.input
  void _ignored
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase
    .from('deed_projects')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_user_id', userId)
    .select(PROJECT_FIELDS)
    .maybeSingle<ProjectRow>()
  if (error) return dbErrorResponse(error, 'Unable to update this project.')
  if (!data) return notFound()
  return NextResponse.json({ project: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx
  const { id } = await ctx.params
  if (!PROJECT_ID_RE.test(id)) return notFound()

  const { data: project, error } = await ownedProject(supabase, userId, id)
  if (error) return dbErrorResponse(error, 'Unable to delete this project.')
  if (!project) return notFound()

  // Bytes first (they are not covered by the row cascade), then the rows.
  const { data: files } = await supabase.from('deed_project_files').select('storage_path').eq('project_id', id).eq('owner_user_id', userId)
  const paths = (files ?? []).map((f: { storage_path: string }) => f.storage_path).filter(Boolean)
  if (paths.length) await supabase.storage.from(FILES_BUCKET).remove(paths)

  await supabase.from('deed_threads').update({ project_id: null }).eq('owner_user_id', userId).eq('project_id', id)
  const { data: deleted, error: delError } = await supabase.from('deed_projects').delete().eq('id', id).eq('owner_user_id', userId).select('id')
  if (delError) return dbErrorResponse(delError, 'Unable to delete this project.')
  if (!deleted || deleted.length === 0) return notFound()
  return NextResponse.json({ deleted: id, files_removed: paths.length })
}
