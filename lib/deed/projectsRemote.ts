'use client'

import { apiUrl } from '@/lib/api'

/**
 * Client of app/api/deed/projects* (PARITY CP-4). Same-origin, the Clerk
 * session cookie is the identity. 401 (signed out) and 503 (tables not
 * applied yet) both read as "nothing here" for lists; write calls return the
 * route's own error text so the customer sees why, never a raw status.
 */

export interface ProjectSummary {
  id: string
  name: string
  county: string | null
  case_number: string | null
  sale_date: string | null
  last_viewed_at: string
  updated_at: string
}

export interface Project extends ProjectSummary {
  parcel_id: string | null
  notes: string
  first_touch: Record<string, string>
  created_at: string
}

export interface ProjectFile {
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

export interface ProjectItem {
  id: string
  kind: 'conversation' | 'report' | 'upload' | 'parcel' | 'sale'
  ref_id: string
  label: string | null
  added_at: string
}

export interface ProjectThread {
  id: string
  title: string
  updated_at: string
}

export interface Greeting {
  shown: boolean
  minutes_since_last_visit: number
  last_viewed_at: string
  new_sales_in_county: number | null
  sale_date_change: { from: string | null; to: string } | null
  lines: string[]
}

/** S3 (PR B): the SIGNAL$ report for this project's sale — names always, values when bought. */
export interface SignalReportAccess {
  sections: readonly string[]
  section_count: number
  price_usd: number
  unlocked: boolean
  status: 'none' | 'pending' | 'delivered' | 'unknown'
  purchased_at: string | null
  delivered_at: string | null
  report_url: string | null
  buy_url: string | null
  reason: string | null
}

export interface ShareInfo {
  token: string
  shared_at: string | null
  views: number
}

export interface ProjectDetail {
  project: Project
  files: ProjectFile[]
  items: ProjectItem[]
  threads: ProjectThread[]
  greeting: Greeting
  report: SignalReportAccess
  /** Active share tokens by file id (PR B). */
  shares: Record<string, ShareInfo>
}

export type ReportFormat = 'json' | 'csv' | 'pdf'
/** Generated reports are ordinary project files under these names. */
export const REPORT_FILENAMES: Record<ReportFormat, string> = {
  json: 'Project report.json',
  csv: 'Project report.csv',
  pdf: 'Project report.pdf',
}
export function isReportFile(f: { filename: string }): boolean {
  return Object.values(REPORT_FILENAMES).includes(f.filename)
}

export interface ProjectCreate {
  name?: string
  county?: string | null
  case_number?: string | null
  parcel_id?: string | null
  sale_date?: string | null
  notes?: string
  first_touch?: Record<string, string>
}

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  try {
    const res = await fetch(apiUrl(path), {
      cache: 'no-store',
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
    })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    if (!res.ok) {
      const error = (json as { error?: string } | null)?.error || (res.status === 401 ? 'Sign in to use projects.' : `Request failed (${res.status})`)
      return { ok: false, status: res.status, error }
    }
    return { ok: true, data: json as T }
  } catch (err) {
    return { ok: false, status: 0, error: (err as Error).message || 'Network error' }
  }
}

export async function listProjects(): Promise<ProjectSummary[] | null> {
  const r = await call<{ projects?: ProjectSummary[] }>('/api/deed/projects')
  return r.ok ? (r.data.projects ?? []) : null
}

export function createProject(input: ProjectCreate) {
  return call<{ project: Project }>('/api/deed/projects', { method: 'POST', body: JSON.stringify(input) })
}

export function getProject(id: string, opts: { peek?: boolean } = {}) {
  return call<ProjectDetail>(`/api/deed/projects/${encodeURIComponent(id)}${opts.peek ? '?peek=1' : ''}`)
}

export function updateProject(id: string, patch: ProjectCreate) {
  return call<{ project: Project }>(`/api/deed/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteProject(id: string) {
  return call<{ deleted: string }>(`/api/deed/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function uploadProjectFile(id: string, file: { filename: string; mime_type: string; data_base64: string }) {
  return call<{ file: ProjectFile }>(`/api/deed/projects/${encodeURIComponent(id)}/files`, { method: 'POST', body: JSON.stringify(file) })
}

export function renameProjectFile(id: string, fileId: string, filename: string) {
  return call<{ file: ProjectFile }>(`/api/deed/projects/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ filename }),
  })
}

export function deleteProjectFile(id: string, fileId: string) {
  return call<{ deleted: string }>(`/api/deed/projects/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' })
}

export function downloadUrl(id: string, fileId: string) {
  return call<{ url: string; expires_at: string; filename: string }>(
    `/api/deed/projects/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}/download`
  )
}

/** Same-tab change signal so the sidebar / sheet refresh after a write. */
export function notifyProjectsChanged() {
  try {
    window.dispatchEvent(new Event('biddeed:projects'))
  } catch {
    /* ignore */
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Reads a File as the base64 the upload route expects. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// PR B — generated reports and share links.

export function generateReport(id: string, format: ReportFormat) {
  return call<{ file: ProjectFile; format: ReportFormat; unlocked: boolean }>(`/api/deed/projects/${encodeURIComponent(id)}/reports`, {
    method: 'POST',
    body: JSON.stringify({ format }),
  })
}

export function shareFile(id: string, fileId: string) {
  return call<{ token: string; url: string; shared_at: string; views: number; existing: boolean }>(
    `/api/deed/projects/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}/share`,
    { method: 'POST' }
  )
}

export function revokeShare(id: string, fileId: string) {
  return call<{ revoked: string; revoked_at: string }>(`/api/deed/projects/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}/share`, { method: 'DELETE' })
}

export function shareUrlFor(token: string): string {
  return `${window.location.origin}/r/${token}`
}
