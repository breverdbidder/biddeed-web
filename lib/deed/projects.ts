import type { SupabaseClient } from '@supabase/supabase-js'

import { getCountyBySlug } from '@/lib/counties'
import { isNotConfigured } from '@/lib/deed/server'

/**
 * Projects (PARITY CP-4, issue #19847) — server-side helpers shared by the
 * app/api/deed/projects* routes and by /api/deed when a chat is scoped to a
 * project. Nothing here is imported by client code.
 *
 * Identity is the Clerk `sub` from requireDeedContext() (lib/deed/server.ts);
 * every query below carries the owner filter, so another customer's project
 * id reads as "not found", never as "forbidden" — existence is not confirmed.
 *
 * Tables: deed_projects, deed_project_files, deed_project_items
 * (supabase/migrations/20260917233000_deed_projects.sql). Bytes live in the
 * private `artifacts` bucket under projects/{project}/{file}/v{n}/{name}.
 */

export const PROJECT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const FILE_ID_RE = PROJECT_ID_RE
export const COUNTY_RE = /^[a-z_]{2,40}$/
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const FILES_BUCKET = 'artifacts'
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const SIGNED_URL_SECONDS = 600
/** S1: the greeting is shown when the project was last opened at least this long ago. */
export const S1_MIN_GAP_MS = 10 * 60 * 1000
/** Total characters of project files folded into one chat turn (shared across files). */
export const MAX_PROJECT_CONTEXT_CHARS = 6_000
export const MAX_NAME = 120
export const MAX_NOTES = 20_000
export const PROJECT_LIST_LIMIT = 50

export const PROJECT_FIELDS = 'id,name,county,case_number,parcel_id,sale_date,notes,first_touch,last_viewed_at,created_at,updated_at'
export const PROJECT_LIST_FIELDS = 'id,name,county,case_number,sale_date,last_viewed_at,updated_at'
export const FILE_FIELDS = 'id,project_id,filename,mime_type,size_bytes,version,extraction_status,created_at,updated_at'
export const ITEM_FIELDS = 'id,kind,ref_id,label,added_at'

export interface ProjectRow {
  id: string
  name: string
  county: string | null
  case_number: string | null
  parcel_id: string | null
  sale_date: string | null
  notes: string
  first_touch: Record<string, unknown>
  last_viewed_at: string
  created_at: string
  updated_at: string
}

export interface ProjectFileRow {
  id: string
  project_id: string
  filename: string
  mime_type: string | null
  size_bytes: number
  version: number
  extraction_status: 'ok' | 'unsupported' | 'failed' | 'pending'
  created_at: string
  updated_at: string
}

export interface ProjectInput {
  name?: string
  county?: string | null
  case_number?: string | null
  parcel_id?: string | null
  sale_date?: string | null
  notes?: string
  first_touch?: Record<string, string>
}

export function countyName(slug: string | null | undefined): string | null {
  if (!slug) return null
  const hit = getCountyBySlug(slug)
  if (hit) return hit.name
  return slug.replace(/_/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  return v.replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * Validates a create / patch body. Returns the fields that were present and
 * valid; a field that is present but malformed is an error, a missing field
 * is simply absent (so PATCH only touches what it names).
 */
export function cleanProjectInput(body: unknown): { ok: true; input: ProjectInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' }
  const b = body as Record<string, unknown>
  const input: ProjectInput = {}

  if (b.name !== undefined) {
    const name = str(b.name, MAX_NAME)
    if (!name) return { ok: false, error: 'A project name is required' }
    input.name = name
  }
  if (b.county !== undefined) {
    if (b.county === null || b.county === '') input.county = null
    else {
      const county = typeof b.county === 'string' ? b.county.trim().toLowerCase().replace(/[\s-]+/g, '_') : ''
      if (!COUNTY_RE.test(county)) return { ok: false, error: 'Unknown county' }
      input.county = county
    }
  }
  if (b.case_number !== undefined) {
    if (b.case_number === null || b.case_number === '') input.case_number = null
    else {
      const v = str(b.case_number, 80)
      if (!v) return { ok: false, error: 'Invalid case number' }
      input.case_number = v
    }
  }
  if (b.parcel_id !== undefined) {
    if (b.parcel_id === null || b.parcel_id === '') input.parcel_id = null
    else {
      const v = str(b.parcel_id, 80)
      if (!v) return { ok: false, error: 'Invalid parcel id' }
      input.parcel_id = v
    }
  }
  if (b.sale_date !== undefined) {
    if (b.sale_date === null || b.sale_date === '') input.sale_date = null
    else if (typeof b.sale_date === 'string' && ISO_DATE_RE.test(b.sale_date) && !Number.isNaN(Date.parse(b.sale_date))) input.sale_date = b.sale_date
    else return { ok: false, error: 'Sale date must be YYYY-MM-DD' }
  }
  if (b.notes !== undefined) {
    if (typeof b.notes !== 'string') return { ok: false, error: 'Invalid notes' }
    input.notes = b.notes.slice(0, MAX_NOTES)
  }
  if (b.first_touch !== undefined) {
    if (!b.first_touch || typeof b.first_touch !== 'object' || Array.isArray(b.first_touch)) return { ok: false, error: 'Invalid first_touch' }
    const ft: Record<string, string> = {}
    for (const key of ['source', 'county', 'case', 'intent', 'parcel'] as const) {
      const v = (b.first_touch as Record<string, unknown>)[key]
      if (typeof v === 'string' && v.trim()) ft[key] = v.trim().slice(0, 120)
    }
    input.first_touch = ft
  }
  return { ok: true, input }
}

/** "Brevard — case 05-2026-CA-012345" / "Brevard County" / "New project". */
export function defaultProjectName(input: Pick<ProjectInput, 'county' | 'case_number' | 'parcel_id'>): string {
  const county = countyName(input.county)
  if (county && input.case_number) return `${county} — case ${input.case_number}`.slice(0, MAX_NAME)
  if (county && input.parcel_id) return `${county} — parcel ${input.parcel_id}`.slice(0, MAX_NAME)
  if (county) return `${county} County`
  return 'New project'
}

export async function ownedProject(supabase: SupabaseClient, userId: string, id: string) {
  return supabase.from('deed_projects').select(PROJECT_FIELDS).eq('owner_user_id', userId).eq('id', id).maybeSingle<ProjectRow>()
}

/** Path separators and control characters out; the display name is kept as typed. */
export function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  return (cleaned || 'file').slice(0, 255)
}

/** Storage keys are ASCII-only so a signed URL never depends on encoding rules. */
export function storagePath(projectId: string, fileId: string, version: number, filename: string): string {
  const ascii = filename.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'file'
  return `projects/${projectId}/${fileId}/v${version}/${ascii}`
}

export interface Greeting {
  /** true when the project was last opened S1_MIN_GAP_MS or more ago. */
  shown: boolean
  minutes_since_last_visit: number
  last_viewed_at: string
  new_sales_in_county: number | null
  sale_date_change: { from: string | null; to: string } | null
  lines: string[]
}

function humanDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * S1 persistent context. What changed since the customer was last here, from
 * the auctions SSOT (multi_county_auctions) — real counts, never a template
 * sentence with no number behind it. The caller touches last_viewed_at after
 * this runs, so the window is [last visit, now].
 */
export async function projectGreeting(supabase: SupabaseClient, project: ProjectRow): Promise<Greeting> {
  const lastViewed = Date.parse(project.last_viewed_at)
  const gapMs = Math.max(0, Date.now() - (Number.isNaN(lastViewed) ? Date.now() : lastViewed))
  const minutes = Math.floor(gapMs / 60_000)
  const greeting: Greeting = {
    shown: gapMs >= S1_MIN_GAP_MS,
    minutes_since_last_visit: minutes,
    last_viewed_at: project.last_viewed_at,
    new_sales_in_county: null,
    sale_date_change: null,
    lines: [],
  }
  if (!greeting.shown) return greeting

  const county = countyName(project.county)
  if (project.county) {
    const { count } = await supabase
      .from('multi_county_auctions')
      .select('id', { count: 'exact', head: true })
      .ilike('county', project.county)
      .in('auction_status', ['upcoming', 'scheduled'])
      .gt('created_at', project.last_viewed_at)
    if (typeof count === 'number') {
      greeting.new_sales_in_county = count
      greeting.lines.push(
        count === 0
          ? `No new ${county} sales since you were here.`
          : `${count.toLocaleString('en-US')} new ${county} ${count === 1 ? 'sale' : 'sales'} since you were here.`
      )
    }
  }
  if (project.county && project.case_number) {
    const { data } = await supabase
      .from('multi_county_auctions')
      .select('auction_date,auction_status')
      .ilike('county', project.county)
      .eq('case_number', project.case_number)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<{ auction_date: string | null; auction_status: string | null }>()
    if (data?.auction_date && data.auction_date !== project.sale_date) {
      greeting.sale_date_change = { from: project.sale_date, to: data.auction_date }
      greeting.lines.push(
        project.sale_date
          ? `Sale date moved from ${humanDate(project.sale_date)} to ${humanDate(data.auction_date)}.`
          : `Sale date is ${humanDate(data.auction_date)}.`
      )
    }
    if (data?.auction_status && !['upcoming', 'scheduled'].includes(data.auction_status)) {
      greeting.lines.push(`This sale is now marked ${data.auction_status.replace(/_/g, ' ')}.`)
    }
  }
  const days = Math.floor(minutes / 1440)
  const when = days >= 1 ? `${days} ${days === 1 ? 'day' : 'days'}` : minutes >= 60 ? `${Math.floor(minutes / 60)} h` : `${minutes} min`
  greeting.lines.unshift(`Welcome back — last here ${when} ago.`)
  return greeting
}

/** Latest version of every filename (files keep older versions downloadable). */
export function latestVersions<T extends { filename: string; version: number }>(files: T[]): T[] {
  const byName = new Map<string, T>()
  for (const f of files) {
    const cur = byName.get(f.filename)
    if (!cur || f.version > cur.version) byName.set(f.filename, f)
  }
  return [...byName.values()]
}

export interface ProjectChatContext {
  text: string
  cited: string[]
}

/**
 * S4: what a project-scoped turn carries to the model — the project's own
 * facts and the text of its files, sharing MAX_PROJECT_CONTEXT_CHARS across
 * the latest version of each readable file. Returned with the list of file
 * names actually folded in, so the route can say (in a header) exactly what
 * Deed was given to cite.
 */
export async function projectChatContext(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<{ ok: true; ctx: ProjectChatContext } | { ok: false; status: number; error: string }> {
  const { data: project, error } = await ownedProject(supabase, userId, projectId)
  if (error) return { ok: false, status: isNotConfigured(error) ? 503 : 502, error: 'Could not read the project.' }
  if (!project) return { ok: false, status: 404, error: 'That project is not available.' }

  const { data: files } = await supabase
    .from('deed_project_files')
    .select('id,filename,version,extraction_status,extracted_text')
    .eq('project_id', project.id)
    .eq('owner_user_id', userId)
    .order('version', { ascending: false })
  const readable = latestVersions((files ?? []) as Array<{ id: string; filename: string; version: number; extraction_status: string; extracted_text: string | null }>)
    .filter((f) => f.extraction_status === 'ok' && f.extracted_text)

  const head: string[] = [`Project "${project.name}"`]
  if (project.county) head.push(`County: ${countyName(project.county)}`)
  if (project.case_number) head.push(`Case: ${project.case_number}`)
  if (project.parcel_id) head.push(`Parcel: ${project.parcel_id}`)
  if (project.sale_date) head.push(`Sale date: ${project.sale_date}`)
  if (project.notes.trim()) head.push(`Customer notes: ${project.notes.trim().slice(0, 1500)}`)

  const cited: string[] = []
  const parts: string[] = []
  let remaining = MAX_PROJECT_CONTEXT_CHARS
  readable.forEach((f, i) => {
    const share = Math.floor(remaining / (readable.length - i))
    if (share < 200) return
    const text = (f.extracted_text as string).slice(0, share)
    const truncated = text.length < (f.extracted_text as string).length
    remaining -= text.length
    cited.push(f.filename)
    parts.push(`File "${f.filename}" (v${f.version})${truncated ? ' [truncated]' : ''}:\n-----\n${text}\n-----`)
  })

  const text = [
    'Project context — cite a file by its name when you use it, and say when the files do not cover the question:',
    head.join('\n'),
    ...parts,
  ].join('\n\n')
  return { ok: true, ctx: { text, cited } }
}

// ---------------------------------------------------------------------------
// PR B — share links (/projects/shared/{token}) and generated reports.

/** 32 random bytes as base64url = 43 chars; the column check allows 32–64. */
export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/
export const SHARE_FIELDS = 'id,share_token,shared_at,share_revoked_at,share_views'

export function newShareToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface ShareRow {
  id: string
  share_token: string | null
  shared_at: string | null
  share_revoked_at: string | null
  share_views: number
}

/**
 * Active shares of a project's files: {file id → token}. Tolerates the PR B
 * migration not being applied yet (the columns do not exist → empty map), so
 * the project page keeps working; only sharing itself answers 503 then.
 */
export async function activeShares(supabase: SupabaseClient, userId: string, projectId: string): Promise<Record<string, { token: string; shared_at: string | null; views: number }>> {
  const { data, error } = await supabase
    .from('deed_project_files')
    .select(SHARE_FIELDS)
    .eq('project_id', projectId)
    .eq('owner_user_id', userId)
    .not('share_token', 'is', null)
    .is('share_revoked_at', null)
  if (error || !data) return {}
  const out: Record<string, { token: string; shared_at: string | null; views: number }> = {}
  for (const row of data as ShareRow[]) if (row.share_token) out[row.id] = { token: row.share_token, shared_at: row.shared_at, views: row.share_views ?? 0 }
  return out
}
