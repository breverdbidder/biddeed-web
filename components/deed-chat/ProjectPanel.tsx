'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Download, FileDown, FileText, FolderKanban, Link2, Link2Off, Lock, MessageSquarePlus, Paperclip, Pencil, Trash2, X } from 'lucide-react'
import Link from 'next/link'

import { countyLabel } from '@/lib/deed/context'
import {
  deleteProject,
  deleteProjectFile,
  downloadUrl,
  fileToBase64,
  formatBytes,
  generateReport,
  getProject,
  isReportFile,
  notifyProjectsChanged,
  renameProjectFile,
  revokeShare,
  shareFile,
  shareUrlFor,
  updateProject,
  uploadProjectFile,
  type ProjectDetail,
  type ProjectFile,
  type ReportFormat,
} from '@/lib/deed/projectsRemote'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  /** The thread open under this project, if any — highlighted in the chats row. */
  activeThreadId: string | null
  /** Called after the project is deleted so the page can leave it. */
  onDeleted: () => void
}

const MAX_UPLOAD = 20 * 1024 * 1024
const bodyText = 'text-base leading-6 sm:text-[15px]'
const btn =
  'inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'
const iconBtn =
  'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function groupVersions(files: ProjectFile[]) {
  const byName = new Map<string, ProjectFile[]>()
  for (const f of files) byName.set(f.filename, [...(byName.get(f.filename) ?? []), f])
  return [...byName.entries()].map(([filename, versions]) => ({
    filename,
    latest: versions.reduce((a, b) => (a.version >= b.version ? a : b)),
    older: versions.filter((v) => v !== versions.reduce((a, b) => (a.version >= b.version ? a : b))).sort((a, b) => b.version - a.version),
  }))
}

/**
 * The project header on /chat?project=<id> (and on a thread scoped to it):
 * what the project is, what changed since the last visit (S1), its chats
 * (S4), and its files — upload, version, rename, download, delete (the
 * "attachment and download abilities" of #19847). PARITY CP-4.
 *
 * PR B adds three things: generated reports (a JSON / CSV / PDF snapshot of
 * the project, versioned like any file), share links (/r/{token}, revocable)
 * on every file, and the SIGNAL$ card — the report's 18 section names with
 * their values locked until this account has bought the report for this sale
 * (S3 progressive disclosure), unlocking in place.
 */
export default function ProjectPanel({ projectId, activeThreadId, onDeleted }: Props) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filesOpen, setFilesOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [fileRename, setFileRename] = useState<{ id: string; value: string } | null>(null)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [signalOpen, setSignalOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // The first load consumes the S1 window (touches last_viewed_at); refreshes
  // after a write peek so the greeting the customer is reading does not vanish.
  const load = useCallback(
    async (peek: boolean) => {
      const r = await getProject(projectId, { peek })
      if (!r.ok) {
        setError(r.status === 404 ? 'This project is not available.' : r.error)
        return
      }
      setError(null)
      setDetail((prev) => (peek && prev ? { ...r.data, greeting: prev.greeting } : r.data))
      if (!peek && r.data.files.length === 0 && r.data.threads.length === 0) setFilesOpen(true)
    },
    [projectId]
  )

  useEffect(() => {
    setDetail(null)
    void load(false)
  }, [load])

  useEffect(() => {
    const onThreads = () => void load(true)
    window.addEventListener('biddeed:threads', onThreads)
    return () => window.removeEventListener('biddeed:threads', onThreads)
  }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD) {
      setNotice(`${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD)}.`)
      return
    }
    setBusy('upload')
    try {
      const data_base64 = await fileToBase64(file)
      const r = await uploadProjectFile(projectId, { filename: file.name, mime_type: file.type, data_base64 })
      if (!r.ok) setNotice(r.error)
      else {
        setNotice(
          r.data.file.extraction_status === 'ok'
            ? `${r.data.file.filename} v${r.data.file.version} — saved. Deed will cite it in this project.`
            : `${r.data.file.filename} v${r.data.file.version} — saved (no text preview for this file type).`
        )
        setFilesOpen(true)
        await load(true)
        notifyProjectsChanged()
      }
    } catch (err) {
      setNotice((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function download(f: ProjectFile) {
    setBusy(`dl:${f.id}`)
    const r = await downloadUrl(projectId, f.id)
    setBusy(null)
    if (!r.ok) {
      setNotice(r.error)
      return
    }
    // A 10-minute signed URL with the customer's own file name as the download name.
    window.location.assign(r.data.url)
  }

  async function removeFile(f: ProjectFile) {
    if (!window.confirm(`Delete ${f.filename} v${f.version}? This cannot be undone.`)) return
    setBusy(`rm:${f.id}`)
    const r = await deleteProjectFile(projectId, f.id)
    setBusy(null)
    if (!r.ok) setNotice(r.error)
    else await load(true)
  }

  async function saveFileRename() {
    if (!fileRename) return
    const value = fileRename.value.trim()
    if (!value) return
    setBusy(`rn:${fileRename.id}`)
    const r = await renameProjectFile(projectId, fileRename.id, value)
    setBusy(null)
    if (!r.ok) setNotice(r.error)
    else {
      setFileRename(null)
      await load(true)
    }
  }

  async function makeReport(format: ReportFormat) {
    setBusy(`report:${format}`)
    const r = await generateReport(projectId, format)
    setBusy(null)
    if (!r.ok) {
      setNotice(r.error)
      return
    }
    setNotice(`${r.data.file.filename} v${r.data.file.version} — ready to download or share.`)
    setReportsOpen(true)
    await load(true)
  }

  async function share(f: ProjectFile) {
    setBusy(`share:${f.id}`)
    const r = await shareFile(projectId, f.id)
    setBusy(null)
    if (!r.ok) {
      setNotice(r.error)
      return
    }
    await copyLink(r.data.token)
    await load(true)
  }

  async function copyLink(token: string) {
    const url = shareUrlFor(token)
    try {
      await navigator.clipboard.writeText(url)
      setNotice(`Link copied — anyone with it can open this file until you revoke it: ${url}`)
    } catch {
      setNotice(`Share link: ${url}`)
    }
  }

  async function unshare(f: ProjectFile) {
    setBusy(`unshare:${f.id}`)
    const r = await revokeShare(projectId, f.id)
    setBusy(null)
    if (!r.ok) setNotice(r.error)
    else {
      setNotice(`Share link revoked — it answers "not found" from now on.`)
      await load(true)
    }
  }

  async function saveName() {
    const value = nameDraft.trim()
    if (!value || !detail || value === detail.project.name) {
      setRenaming(false)
      return
    }
    const r = await updateProject(projectId, { name: value })
    if (!r.ok) setNotice(r.error)
    else {
      setDetail({ ...detail, project: r.data.project })
      notifyProjectsChanged()
    }
    setRenaming(false)
  }

  async function remove() {
    if (!detail) return
    if (!window.confirm(`Delete the project "${detail.project.name}" and its ${detail.files.length} file${detail.files.length === 1 ? '' : 's'}? Chats keep their text and lose the project.`)) return
    setBusy('delete')
    const r = await deleteProject(projectId)
    setBusy(null)
    if (!r.ok) {
      setNotice(r.error)
      return
    }
    notifyProjectsChanged()
    onDeleted()
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6" data-project-panel="error">
        <h1 className="text-base font-semibold text-foreground">Project</h1>
        <p className={cn(bodyText, 'mt-2 rounded-lg border border-border bg-card p-4 text-muted-foreground')}>{error}</p>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6" data-project-panel="loading" aria-busy="true">
        <h1 className="sr-only">Project</h1>
        <div className="h-16 animate-none rounded-lg border border-border bg-card" />
      </div>
    )
  }

  const { project, files, threads, greeting, report, shares } = detail
  const uploads = files.filter((f) => !isReportFile(f))
  const reports = files.filter(isReportFile).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const groups = groupVersions(uploads)

  // Share / copy / revoke for one stored file version (uploads and reports alike).
  const shareControls = (f: ProjectFile) => {
    const active = shares[f.id]
    return active ? (
      <>
        <button type="button" onClick={() => void copyLink(active.token)} className={btn} data-share={f.id} data-share-token={active.token} aria-label={`Copy the share link for ${f.filename} v${f.version}`}>
          <Link2 className="size-4" aria-hidden />
          Copy link{active.views ? ` · ${active.views}` : ''}
        </button>
        <button type="button" onClick={() => unshare(f)} disabled={busy === `unshare:${f.id}`} className={iconBtn} data-unshare={f.id} aria-label={`Revoke the share link for ${f.filename} v${f.version}`}>
          <Link2Off className="size-4" aria-hidden />
        </button>
      </>
    ) : (
      <button type="button" onClick={() => share(f)} disabled={busy === `share:${f.id}`} className={iconBtn} data-share-create={f.id} aria-label={`Share ${f.filename} v${f.version} by link`}>
        <Link2 className="size-4" aria-hidden />
      </button>
    )
  }
  const meta = [
    project.county ? `${countyLabel(project.county)} County` : null,
    project.case_number ? `case ${project.case_number}` : null,
    project.parcel_id ? `parcel ${project.parcel_id}` : null,
    project.sale_date ? `sale ${project.sale_date}` : null,
  ].filter(Boolean)

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6" aria-label={`Project ${project.name}`} data-project-panel="ready" data-project-id={project.id}>
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-start gap-2 px-4 py-3">
          <FolderKanban className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            {renaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveName()
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <label htmlFor="project-rename" className="sr-only">
                  Project name
                </label>
                <input
                  id="project-rename"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={120}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-[15px]"
                />
                <button type="submit" className={btn}>
                  Save
                </button>
                <button type="button" onClick={() => setRenaming(false)} className={btn}>
                  Cancel
                </button>
              </form>
            ) : (
              <h1 className="flex flex-wrap items-center gap-1 text-base font-semibold text-foreground">
                <span data-project-name>{project.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(project.name)
                    setRenaming(true)
                  }}
                  className={iconBtn}
                  aria-label="Rename project"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              </h1>
            )}
            <p className={cn(bodyText, 'text-muted-foreground')}>{meta.length ? meta.join(' · ') : 'No property attached yet — tell Deed the county and case.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setFilesOpen((v) => !v)} className={btn} aria-expanded={filesOpen} aria-controls="project-files">
              <Paperclip className="size-4" aria-hidden />
              Files ({groups.length})
              {filesOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
            </button>
            <button type="button" onClick={() => setReportsOpen((v) => !v)} className={btn} aria-expanded={reportsOpen} aria-controls="project-reports">
              <FileDown className="size-4" aria-hidden />
              Reports ({reports.length})
              {reportsOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => setSignalOpen((v) => !v)}
              className={cn(btn, report.unlocked && 'text-primary')}
              aria-expanded={signalOpen}
              aria-controls="project-signal"
              data-signal-report={report.unlocked ? 'unlocked' : 'locked'}
              data-signal-status={report.status}
            >
              {report.unlocked ? <Check className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              SIGNAL$ report
              {signalOpen ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
            </button>
            <Link href={`/chat?project=${encodeURIComponent(project.id)}&new=1`} className={btn}>
              <MessageSquarePlus className="size-4" aria-hidden />
              New chat
            </Link>
            <button type="button" onClick={remove} disabled={busy === 'delete'} className={iconBtn} aria-label="Delete project">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {greeting.shown ? (
          <div className="border-t border-border bg-secondary/50 px-4 py-3" data-greeting="shown" data-minutes={greeting.minutes_since_last_visit}>
            {greeting.lines.map((line, i) => (
              <p key={i} className={cn(bodyText, i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {line}
              </p>
            ))}
          </div>
        ) : (
          <span className="sr-only" data-greeting="hidden" data-minutes={greeting.minutes_since_last_visit} />
        )}

        {threads.length ? (
          <div className="border-t border-border px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chats in this project</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {threads.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/chat?c=${encodeURIComponent(t.id)}`}
                    aria-current={t.id === activeThreadId ? 'page' : undefined}
                    className={cn(btn, t.id === activeThreadId && 'border-primary text-primary')}
                  >
                    {t.title}
                  </Link>
                </li>
              ))}
              {threads.length > 6 ? <li className={cn(bodyText, 'self-center text-muted-foreground')}>+{threads.length - 6} more</li> : null}
            </ul>
          </div>
        ) : null}

        {filesOpen ? (
          <div id="project-files" className="border-t border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Files</p>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'upload'} className={cn(btn, 'text-primary')}>
                <Paperclip className="size-4" aria-hidden />
                {busy === 'upload' ? 'Uploading…' : 'Upload a file'}
              </button>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                accept=".pdf,.txt,.csv,.md,.docx,.xlsx,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/csv,text/markdown"
                aria-label="Upload a file to this project"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void upload(f)
                }}
              />
            </div>
            {groups.length === 0 ? (
              <p className={cn(bodyText, 'mt-2 text-muted-foreground')}>No files yet. PDFs, text and CSV are read so Deed can cite them; other files are kept for download.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border" aria-label="Project files">
                {groups.map(({ filename, latest, older }) => (
                  <li key={filename} className="py-2" data-file={latest.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {fileRename?.id === latest.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            void saveFileRename()
                          }}
                          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                        >
                          <label htmlFor={`rename-${latest.id}`} className="sr-only">
                            File name
                          </label>
                          <input
                            id={`rename-${latest.id}`}
                            autoFocus
                            value={fileRename.value}
                            onChange={(e) => setFileRename({ id: latest.id, value: e.target.value })}
                            maxLength={255}
                            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-[15px]"
                          />
                          <button type="submit" className={btn} disabled={busy === `rn:${latest.id}`}>
                            Save
                          </button>
                          <button type="button" onClick={() => setFileRename(null)} className={iconBtn} aria-label="Cancel rename">
                            <X className="size-4" aria-hidden />
                          </button>
                        </form>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className={cn(bodyText, 'truncate font-medium text-foreground')}>
                            {filename} <span className="text-muted-foreground">v{latest.version}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatBytes(latest.size_bytes)} · {latest.extraction_status === 'ok' ? 'Deed can cite this' : 'stored, not readable as text'}
                            {older.length ? ` · ${older.length} older ${older.length === 1 ? 'version' : 'versions'}` : ''}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => download(latest)} disabled={busy === `dl:${latest.id}`} className={btn} data-download={latest.id}>
                          <Download className="size-4" aria-hidden />
                          Download
                        </button>
                        {shareControls(latest)}
                        <button type="button" onClick={() => setFileRename({ id: latest.id, value: latest.filename })} className={iconBtn} aria-label={`Rename ${filename}`}>
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button type="button" onClick={() => removeFile(latest)} disabled={busy === `rm:${latest.id}`} className={iconBtn} aria-label={`Delete ${filename} v${latest.version}`}>
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                        {older.length ? (
                          <button
                            type="button"
                            onClick={() => setExpanded((m) => ({ ...m, [filename]: !m[filename] }))}
                            className={iconBtn}
                            aria-expanded={Boolean(expanded[filename])}
                            aria-label={`${expanded[filename] ? 'Hide' : 'Show'} older versions of ${filename}`}
                          >
                            {expanded[filename] ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {expanded[filename] && older.length ? (
                      <ul className="mt-1 space-y-1 pl-6">
                        {older.map((v) => (
                          <li key={v.id} className="flex flex-wrap items-center gap-2">
                            <span className={cn(bodyText, 'text-muted-foreground')}>
                              v{v.version} · {formatBytes(v.size_bytes)}
                            </span>
                            <button type="button" onClick={() => download(v)} className={btn} data-download={v.id}>
                              <Download className="size-4" aria-hidden />
                              Download
                            </button>
                            <button type="button" onClick={() => removeFile(v)} className={iconBtn} aria-label={`Delete ${filename} v${v.version}`}>
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {reportsOpen ? (
          <div id="project-reports" className="border-t border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated reports</p>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Generate a project report">
                {(['pdf', 'csv', 'json'] as ReportFormat[]).map((format) => (
                  <button key={format} type="button" onClick={() => void makeReport(format)} disabled={busy === `report:${format}`} className={cn(btn, 'text-primary')} data-generate={format}>
                    <FileDown className="size-4" aria-hidden />
                    {busy === `report:${format}` ? 'Generating…' : format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <p className={cn(bodyText, 'mt-1 text-muted-foreground')}>
              A snapshot of this project — the sale, your notes and files, what Deed said in each chat, and the SIGNAL$ section list — as a real file you can download or share by link.
            </p>
            {reports.length === 0 ? (
              <p className={cn(bodyText, 'mt-2 text-muted-foreground')}>No reports generated yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border" aria-label="Generated reports">
                {reports.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2 py-2" data-report-file={f.id}>
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className={cn(bodyText, 'truncate font-medium text-foreground')}>
                        {f.filename} <span className="text-muted-foreground">v{f.version}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(f.size_bytes)} · {new Date(f.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        {shares[f.id] ? ' · shared by link' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => download(f)} disabled={busy === `dl:${f.id}`} className={btn} data-download={f.id}>
                        <Download className="size-4" aria-hidden />
                        Download
                      </button>
                      {shareControls(f)}
                      <button type="button" onClick={() => removeFile(f)} disabled={busy === `rm:${f.id}`} className={iconBtn} aria-label={`Delete ${f.filename} v${f.version}`}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {signalOpen ? (
          <div id="project-signal" className="border-t border-border px-4 py-3" data-signal-sections={report.section_count}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SIGNAL$ Property Report · {report.section_count} sections</p>
              {report.unlocked ? (
                <span className={cn(bodyText, 'inline-flex items-center gap-1 font-medium text-primary')}>
                  <Check className="size-4" aria-hidden />
                  {report.status === 'delivered' ? 'Purchased and delivered' : 'Purchased — in production'}
                </span>
              ) : report.buy_url ? (
                <Link href={report.buy_url} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90" data-signal-buy>
                  <Lock className="size-4" aria-hidden />
                  Unlock all {report.section_count} sections — ${report.price_usd}
                </Link>
              ) : null}
            </div>
            <p className={cn(bodyText, 'mt-1 text-muted-foreground')}>
              {report.unlocked
                ? report.status === 'delivered'
                  ? `Delivered ${report.delivered_at ? new Date(report.delivered_at).toLocaleDateString('en-US', { dateStyle: 'medium' }) : ''} to your email.${report.report_url ? '' : ' The PDF is in your inbox.'}`
                  : `Purchased ${report.purchased_at ? new Date(report.purchased_at).toLocaleDateString('en-US', { dateStyle: 'medium' }) : ''}. The report is being produced and lands in your inbox.`
                : report.reason ?? 'The section names are the report\u2019s. Their values unlock for this sale with the report.'}
            </p>
            {report.unlocked && report.report_url ? (
              <a href={report.report_url} className={cn(btn, 'mt-2 text-primary')} target="_blank" rel="noopener noreferrer" data-signal-open>
                <FileText className="size-4" aria-hidden />
                Open the delivered PDF
              </a>
            ) : null}
            <ol className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2" aria-label="Report sections">
              {report.sections.map((name, i) => (
                <li key={name} className={cn(bodyText, 'flex items-start gap-2')} data-signal-section={report.unlocked ? 'unlocked' : 'locked'}>
                  {report.unlocked ? <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden /> : <Lock className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className={report.unlocked ? 'text-foreground' : 'text-muted-foreground'}>
                    <span className="text-muted-foreground">{i + 1}.</span> {name}
                    {report.unlocked ? null : <span className="sr-only"> — locked</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {notice ? (
          <p role="status" className={cn(bodyText, 'border-t border-border px-4 py-2 text-muted-foreground')}>
            {notice}
          </p>
        ) : null}
      </div>
    </section>
  )
}
