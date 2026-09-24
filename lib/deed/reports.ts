import type { SupabaseClient } from '@supabase/supabase-js'

import { REPORT_PRICE_USD, REPORT_SECTIONS } from '@/lib/report-sections'
import { isNotConfigured } from '@/lib/deed/server'
import { renderTextPdf, type PdfBlock } from '@/lib/deed/pdf'
import { countyName, latestVersions, type ProjectRow } from '@/lib/deed/projects'
import { decideReportAccess, sessionsToCheck, type ClaimRow, type PurchaseRow, type QueueRow } from '@/lib/deed/report-access'

/**
 * PARITY CP-4 PR B — the two report surfaces of a project.
 *
 * 1. SIGNAL$ progressive disclosure (S3). The 18 section NAMES are always
 *    shown; their VALUES are locked until the account has the report for
 *    this project's sale: a PAID one-time purchase (report_delivery_queue
 *    row delivered, or backed by a non-revoked `purchases` row) or a
 *    subscriber claim (signal_report_claims), matched on county + case_number
 *    + the Clerk-verified primary email, never a guess. See
 *    lib/deed/report-access.ts (SIGNAL-1).
 *
 * 2. Generated project reports. A JSON / CSV / PDF snapshot of the project —
 *    facts, the sale from the auctions SSOT, files, items, what Deed said in
 *    each chat — stored as an ordinary versioned project file so download,
 *    share and cite all work the same way.
 */

export type SignalReportStatus = 'none' | 'pending' | 'delivered' | 'unknown'

export interface SignalReportAccess {
  sections: readonly string[]
  section_count: number
  price_usd: number
  /** true when this account bought the SIGNAL$ report for this project's sale. */
  unlocked: boolean
  status: SignalReportStatus
  purchased_at: string | null
  delivered_at: string | null
  /** The delivered PDF link when one is on file (a signed URL; may expire). */
  report_url: string | null
  /** Where to buy it with this project's sale prefilled; null when the project has no sale yet. */
  buy_url: string | null
  /** Why it cannot be checked (no county + case on the project, or no email on the account). */
  reason: string | null
}

/** `_` and `%` are wildcards to ilike; an email like j_doe@x.com must match itself only. */
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export async function signalReportAccess(supabase: SupabaseClient, email: string | null, project: ProjectRow): Promise<SignalReportAccess> {
  const base: SignalReportAccess = {
    sections: REPORT_SECTIONS,
    section_count: REPORT_SECTIONS.length,
    price_usd: REPORT_PRICE_USD,
    unlocked: false,
    status: 'none',
    purchased_at: null,
    delivered_at: null,
    report_url: null,
    buy_url: null,
    reason: null,
  }
  if (!project.county || !project.case_number) {
    return { ...base, status: 'unknown', reason: 'Add the county and case number to this project to check the report.' }
  }
  base.buy_url = `/buy-report?county=${encodeURIComponent(project.county)}&case=${encodeURIComponent(project.case_number)}`
  if (!email) return { ...base, status: 'unknown', reason: 'No email on this account to match a purchase against.' }

  // SIGNAL-1: a queue row is written when Stripe Checkout opens, before any
  // payment, so it is only a candidate. It unlocks when delivered or when a
  // non-revoked `purchases` row exists for its session; a subscriber claim
  // unlocks too. The rule lives in lib/deed/report-access.ts.
  const byEmail = escapeLike(email)
  const byCounty = escapeLike(project.county)
  const [queueRes, claimRes] = await Promise.all([
    supabase
      .from('report_delivery_queue')
      .select('id,status,stripe_session_id,report_pdf_url,created_at,delivered_at')
      .ilike('customer_email', byEmail)
      .ilike('county', byCounty)
      .eq('case_number', project.case_number)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('signal_report_claims')
      .select('id,status,report_pdf_url,created_at,delivered_at')
      .ilike('email', byEmail)
      .ilike('county', byCounty)
      .eq('case_number', project.case_number)
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  const unavailable = (e: { code?: string }) => ({
    ...base,
    status: 'unknown' as const,
    reason: isNotConfigured(e) ? 'Report purchases are not configured on this deployment.' : 'Could not check report purchases right now.',
  })
  if (queueRes.error) return unavailable(queueRes.error)
  // Claims are a second route to the report; a deployment without the claims
  // table still answers from purchases alone.
  if (claimRes.error && !isNotConfigured(claimRes.error)) return unavailable(claimRes.error)
  const queue = (queueRes.data ?? []) as QueueRow[]
  const claims = (claimRes.error ? [] : claimRes.data ?? []) as ClaimRow[]

  let purchases: PurchaseRow[] = []
  const sessions = sessionsToCheck(queue)
  if (sessions.length > 0) {
    const { data, error } = await supabase.from('purchases').select('stripe_session_id,revoked_at').in('stripe_session_id', sessions)
    if (error) return unavailable(error)
    purchases = (data ?? []) as PurchaseRow[]
  }

  const decision = decideReportAccess(queue, purchases, claims)
  return {
    ...base,
    unlocked: decision.unlocked,
    status: decision.status,
    purchased_at: decision.purchased_at,
    delivered_at: decision.delivered_at,
    report_url: decision.report_url,
  }
}

export type ReportFormat = 'json' | 'csv' | 'pdf'
export const REPORT_FORMATS: ReportFormat[] = ['json', 'csv', 'pdf']
export const REPORT_FILENAME: Record<ReportFormat, string> = {
  json: 'Project report.json',
  csv: 'Project report.csv',
  pdf: 'Project report.pdf',
}
export const REPORT_MIME: Record<ReportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
  pdf: 'application/pdf',
}
/** Characters of each chat's last Deed answer kept in the report. */
const CHAT_EXCERPT_CHARS = 600
const MAX_CHATS = 12

interface SaleRow {
  id: string
  property_address: string | null
  city: string | null
  zip: string | null
  auction_date: string | null
  auction_time: string | null
  auction_status: string | null
  sale_type: string | null
  opening_bid: number | null
  judgment_amount: number | null
  plaintiff: string | null
  assessed_value: number | null
  market_value: number | null
  property_type: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  year_built: number | null
  parcel_id: string | null
}

interface ThreadRow {
  id: string
  title: string
  updated_at: string
  turns: Array<{ role: 'user' | 'assistant'; content: string; cited?: string[] }> | null
}

export interface ProjectReportData {
  generated_at: string
  project: {
    id: string
    name: string
    county: string | null
    county_name: string | null
    case_number: string | null
    parcel_id: string | null
    sale_date: string | null
    notes: string
    first_touch: Record<string, unknown>
    created_at: string
    last_viewed_at: string
  }
  sale: SaleRow | null
  signal_report: { unlocked: boolean; status: SignalReportStatus; sections: readonly string[]; report_url: string | null }
  files: Array<{ filename: string; version: number; size_bytes: number; mime_type: string | null; readable: boolean; created_at: string }>
  items: Array<{ kind: string; ref_id: string; label: string | null; added_at: string }>
  chats: Array<{ id: string; title: string; updated_at: string; turns: number; last_answer: string | null; cited: string[] }>
}

export async function collectProjectReport(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
  project: ProjectRow
): Promise<ProjectReportData> {
  const [files, items, threads, access, sale] = await Promise.all([
    supabase
      .from('deed_project_files')
      .select('filename,version,size_bytes,mime_type,extraction_status,created_at')
      .eq('project_id', project.id)
      .eq('owner_user_id', userId)
      .order('filename')
      .order('version', { ascending: false }),
    supabase.from('deed_project_items').select('kind,ref_id,label,added_at').eq('project_id', project.id).eq('owner_user_id', userId).order('added_at', { ascending: false }).limit(50),
    supabase.from('deed_threads').select('id,title,updated_at,turns').eq('owner_user_id', userId).eq('project_id', project.id).order('updated_at', { ascending: false }).limit(MAX_CHATS),
    signalReportAccess(supabase, email, project),
    project.county && project.case_number
      ? supabase
          .from('multi_county_auctions')
          .select('id,property_address,city,zip,auction_date,auction_time,auction_status,sale_type,opening_bid,judgment_amount,plaintiff,assessed_value,market_value,property_type,beds,baths,sqft,year_built,parcel_id')
          .ilike('county', project.county)
          .eq('case_number', project.case_number)
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle<SaleRow>()
      : Promise.resolve({ data: null }),
  ])

  const fileRows = (files.data ?? []) as Array<{ filename: string; version: number; size_bytes: number; mime_type: string | null; extraction_status: string; created_at: string }>
  return {
    generated_at: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      county: project.county,
      county_name: countyName(project.county),
      case_number: project.case_number,
      parcel_id: project.parcel_id,
      sale_date: project.sale_date,
      notes: project.notes,
      first_touch: project.first_touch,
      created_at: project.created_at,
      last_viewed_at: project.last_viewed_at,
    },
    sale: (sale as { data: SaleRow | null }).data ?? null,
    signal_report: { unlocked: access.unlocked, status: access.status, sections: access.sections, report_url: access.report_url },
    // Generated reports are files too; the snapshot lists the customer's own uploads only.
    files: latestVersions(fileRows)
      .filter((f) => !Object.values(REPORT_FILENAME).includes(f.filename))
      .map((f) => ({ filename: f.filename, version: f.version, size_bytes: f.size_bytes, mime_type: f.mime_type, readable: f.extraction_status === 'ok', created_at: f.created_at })),
    items: (items.data ?? []) as ProjectReportData['items'],
    chats: ((threads.data ?? []) as ThreadRow[]).map((t) => {
      const turns = Array.isArray(t.turns) ? t.turns : []
      const lastAnswer = [...turns].reverse().find((x) => x.role === 'assistant' && x.content?.trim())
      const cited = new Set<string>()
      for (const x of turns) for (const c of x.cited ?? []) cited.add(c)
      return {
        id: t.id,
        title: t.title,
        updated_at: t.updated_at,
        turns: turns.length,
        last_answer: lastAnswer ? lastAnswer.content.trim().slice(0, CHAT_EXCERPT_CHARS) : null,
        cited: [...cited],
      }
    }),
  }
}

function money(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : '—'
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The report as a flat three-column CSV: section, field, value. */
export function renderReportCsv(d: ProjectReportData): string {
  const rows: Array<[string, string, unknown]> = []
  const p = d.project
  rows.push(['project', 'name', p.name], ['project', 'county', p.county_name ?? ''], ['project', 'case_number', p.case_number ?? ''], ['project', 'parcel_id', p.parcel_id ?? ''], ['project', 'sale_date', p.sale_date ?? ''], ['project', 'notes', p.notes], ['project', 'created_at', p.created_at], ['project', 'generated_at', d.generated_at])
  if (d.sale) {
    const s = d.sale
    for (const [k, v] of Object.entries(s)) rows.push(['sale', k, v ?? ''])
  }
  rows.push(['signal_report', 'status', d.signal_report.status], ['signal_report', 'unlocked', d.signal_report.unlocked ? 'yes' : 'no'])
  d.signal_report.sections.forEach((name, i) => rows.push(['signal_report_section', String(i + 1).padStart(2, '0'), `${name}${d.signal_report.unlocked ? '' : ' (locked)'}`]))
  for (const f of d.files) rows.push(['file', f.filename, `v${f.version} · ${f.size_bytes} bytes · ${f.readable ? 'readable' : 'stored'}`])
  for (const it of d.items) rows.push(['item', it.kind, it.label ?? it.ref_id])
  for (const c of d.chats) rows.push(['chat', c.title, c.last_answer ?? ''])
  return ['section,field,value', ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n') + '\r\n'
}

/** The report as blocks for the text PDF writer (and, joined, as its citeable text). */
export function reportBlocks(d: ProjectReportData): PdfBlock[] {
  const p = d.project
  const b: PdfBlock[] = []
  b.push({ kind: 'title', text: p.name })
  b.push({ kind: 'p', text: `BidDeed.AI project report — generated ${new Date(d.generated_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET` })
  b.push({ kind: 'rule' })
  b.push({ kind: 'h1', text: 'Property' })
  b.push({ kind: 'kv', label: 'County', text: p.county_name ?? 'Not set' })
  b.push({ kind: 'kv', label: 'Case number', text: p.case_number ?? 'Not set' })
  b.push({ kind: 'kv', label: 'Parcel', text: p.parcel_id ?? (d.sale?.parcel_id ?? 'Not set') })
  b.push({ kind: 'kv', label: 'Sale date', text: p.sale_date ?? d.sale?.auction_date ?? 'Not set' })
  if (d.sale) {
    const s = d.sale
    b.push({ kind: 'kv', label: 'Address', text: [s.property_address, s.city, s.zip].filter(Boolean).join(', ') || 'Not on file' })
    b.push({ kind: 'kv', label: 'Sale type', text: `${s.sale_type ?? '—'} · status ${s.auction_status ?? '—'}${s.auction_time ? ` · ${s.auction_time}` : ''}` })
    b.push({ kind: 'kv', label: 'Opening bid', text: money(s.opening_bid) })
    b.push({ kind: 'kv', label: 'Judgment', text: `${money(s.judgment_amount)}${s.plaintiff ? ` · plaintiff ${s.plaintiff}` : ''}` })
    b.push({ kind: 'kv', label: 'Assessed / market', text: `${money(s.assessed_value)} / ${money(s.market_value)}` })
    b.push({ kind: 'kv', label: 'Building', text: [s.property_type, s.beds != null ? `${s.beds} bd` : null, s.baths != null ? `${s.baths} ba` : null, s.sqft ? `${s.sqft.toLocaleString('en-US')} sqft` : null, s.year_built ? `built ${s.year_built}` : null].filter(Boolean).join(' · ') || '—' })
  }
  if (p.notes.trim()) {
    b.push({ kind: 'h2', text: 'Notes' })
    b.push({ kind: 'p', text: p.notes.trim() })
  }
  b.push({ kind: 'h1', text: `SIGNAL$ Property Report — ${d.signal_report.sections.length} sections` })
  b.push({
    kind: 'p',
    text: d.signal_report.unlocked
      ? `Purchased for this sale (${d.signal_report.status}).${d.signal_report.report_url ? ' The delivered PDF is linked from the project.' : ''}`
      : `Not purchased for this sale. The section names below are the report's; their values unlock with the $${REPORT_PRICE_USD} report.`,
  })
  d.signal_report.sections.forEach((name, i) => b.push({ kind: 'bullet', text: `${i + 1}. ${name}${d.signal_report.unlocked ? '' : ' — locked'}` }))
  b.push({ kind: 'h1', text: `Files (${d.files.length})` })
  if (!d.files.length) b.push({ kind: 'p', text: 'No files in this project.' })
  for (const f of d.files) b.push({ kind: 'bullet', text: `${f.filename} — v${f.version}, ${Math.max(1, Math.round(f.size_bytes / 1024))} KB, ${f.readable ? 'readable by Deed' : 'stored'}` })
  if (d.items.length) {
    b.push({ kind: 'h1', text: `Attached (${d.items.length})` })
    for (const it of d.items) b.push({ kind: 'bullet', text: `${it.kind}: ${it.label ?? it.ref_id}` })
  }
  b.push({ kind: 'h1', text: `Chats (${d.chats.length})` })
  if (!d.chats.length) b.push({ kind: 'p', text: 'No chats in this project yet.' })
  for (const c of d.chats) {
    b.push({ kind: 'h2', text: `${c.title} — ${c.turns} turns` })
    if (c.cited.length) b.push({ kind: 'p', text: `Cited: ${c.cited.join(', ')}` })
    b.push({ kind: 'p', text: c.last_answer ? `Deed, last: ${c.last_answer}` : 'No answer recorded.' })
  }
  b.push({ kind: 'rule' })
  b.push({ kind: 'p', text: 'Figures come from the BidDeed.AI auctions record at generation time and from the customer’s own files and notes. Not a title opinion, not an appraisal.' })
  return b
}

export function blocksToText(blocks: PdfBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'kv':
          return `${b.label}: ${b.text}`
        case 'bullet':
          return `- ${b.text}`
        case 'gap':
        case 'rule':
          return ''
        default:
          return b.text ?? ''
      }
    })
    .join('\n')
}

export function renderReport(format: ReportFormat, d: ProjectReportData): { bytes: Uint8Array; text: string } {
  const blocks = reportBlocks(d)
  const text = blocksToText(blocks)
  if (format === 'json') return { bytes: new TextEncoder().encode(JSON.stringify(d, null, 2)), text }
  if (format === 'csv') {
    const csv = renderReportCsv(d)
    return { bytes: new TextEncoder().encode(csv), text }
  }
  return { bytes: renderTextPdf(blocks, `BidDeed.AI · ${d.project.name} · ${d.generated_at.slice(0, 10)}`), text }
}
