/**
 * Sent-alert history for Deed Watches (PARITY CP-5).
 *
 * Every alert the notifier emails is already kept in Supabase
 * (auction_watch_notifications, with its Resend message id and, for a sale
 * date, its calendar file). This module turns those rows into what the
 * Scheduled page shows and what the owner can download: a CSV of every alert
 * and one calendar file of the current sale dates. That is the export Google
 * Drive would otherwise have held; nothing leaves the account's own storage.
 *
 * Pure functions only (no server imports), so they can be tested on their own.
 */

export type NotificationRow = {
  id: number | string
  watch_id: number | string
  alert_type: string
  subject: string | null
  body_text: string | null
  ics: string | null
  send_status: string
  resend_id: string | null
  last_error: string | null
  created_at: string
  sent_at: string | null
  auction_watches: { case_number: string; county: string } | { case_number: string; county: string }[] | null
}

export type SentAlertStatus = 'sent' | 'sending' | 'failed'

export type SentAlert = {
  id: string
  watch_id: string
  case_number: string
  county: string
  alert_type: string
  subject: string
  message: string
  status: SentAlertStatus
  delivery_id: string | null
  created_at: string
  sent_at: string | null
  has_calendar: boolean
}

export type WatchHealth = {
  active: boolean
  schedule: string | null
  last_run_at: string | null
  last_status: string | null
  runs_24h: number
  failed_24h: number
}

export const ALERT_TYPE_LABELS: Record<string, string> = {
  sale_date_change: 'Sale date change',
  opening_bid_change: 'Opening bid change',
  status_change: 'Status change',
}

function watchOf(row: NotificationRow) {
  const w = Array.isArray(row.auction_watches) ? row.auction_watches[0] : row.auction_watches
  return { case_number: w?.case_number ?? '', county: w?.county ?? '' }
}

/** A sent row counts as sent once Resend returned its message id. */
export function alertStatus(row: Pick<NotificationRow, 'send_status' | 'resend_id'>): SentAlertStatus {
  if (row.send_status === 'failed') return 'failed'
  if (row.send_status === 'sent' && row.resend_id) return 'sent'
  return 'sending'
}

export function sentAlert(row: NotificationRow): SentAlert {
  const w = watchOf(row)
  return {
    id: String(row.id),
    watch_id: String(row.watch_id),
    case_number: w.case_number,
    county: w.county,
    alert_type: row.alert_type,
    subject: row.subject ?? '',
    message: row.body_text ?? '',
    status: alertStatus(row),
    delivery_id: row.resend_id,
    created_at: row.created_at,
    sent_at: row.sent_at,
    has_calendar: Boolean(row.ics),
  }
}

const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** 2026-09-23 10:48 ET — sortable, and says which clock it is on. */
export function formatEt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = Object.fromEntries(ET_PARTS.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ET`
}

/**
 * One CSV cell. Quotes when needed, and defuses spreadsheet formulas: a cell
 * that opens with = + - @ (or a tab/CR) is prefixed with a quote mark so a
 * spreadsheet shows it as text instead of running it.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export const CSV_HEADER = ['sent_at_et', 'case_number', 'county', 'alert', 'status', 'subject', 'message', 'delivery_id'] as const

export function alertsCsv(alerts: SentAlert[]): string {
  const lines = [CSV_HEADER.join(',')]
  for (const a of alerts) {
    lines.push([
      formatEt(a.sent_at ?? a.created_at),
      a.case_number,
      a.county,
      ALERT_TYPE_LABELS[a.alert_type] ?? a.alert_type,
      a.status,
      a.subject,
      a.message,
      a.delivery_id ?? '',
    ].map(csvCell).join(','))
  }
  // A BOM so Excel reads the file as UTF-8 (the subjects carry a middle dot).
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function crlf(text: string) {
  return text.replace(/\r?\n/g, '\r\n')
}

/**
 * One calendar holding the current sale date of each watch: rows arrive newest
 * first, so the first event seen for a watch is its latest date and older
 * dates for the same watch are left out.
 */
export function mergeCalendars(rows: Array<Pick<NotificationRow, 'watch_id' | 'ics'>>): string {
  const events: string[] = []
  const seenWatch = new Set<string>()
  const seenUid = new Set<string>()
  for (const row of rows) {
    if (!row.ics) continue
    const watch = String(row.watch_id)
    if (seenWatch.has(watch)) continue
    const found = crlf(row.ics).match(/BEGIN:VEVENT\r\n[\s\S]*?END:VEVENT/g) ?? []
    if (!found.length) continue
    seenWatch.add(watch)
    for (const ev of found) {
      const uid = /\r\nUID:([^\r\n]+)/.exec(ev)?.[1]
      if (uid && seenUid.has(uid)) continue
      if (uid) seenUid.add(uid)
      events.push(ev)
    }
  }
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BidDeed.AI//Deed Watches//EN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:BidDeed.AI auction dates',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n'
}

export function singleCalendar(ics: string): string {
  const text = crlf(ics)
  return text.endsWith('\r\n') ? text : `${text}\r\n`
}

export function exportFilename(kind: 'csv' | 'ics', now: Date, id?: string): string {
  const day = formatEt(now.toISOString()).slice(0, 10)
  if (kind === 'csv') return `biddeed-alerts-${day}.csv`
  return id ? `biddeed-alert-${id}.ics` : `biddeed-auction-dates-${day}.ics`
}

/**
 * The checks run on a schedule (every 15 minutes). Healthy when the job is on,
 * its last run succeeded and that run is recent enough (three missed runs is
 * "delayed", not yet "failing").
 */
export function healthState(h: WatchHealth | null, now: Date): 'healthy' | 'delayed' | 'failing' | 'unknown' {
  if (!h) return 'unknown'
  if (!h.active) return 'failing'
  if (h.last_status && h.last_status !== 'succeeded') return 'failing'
  if (!h.last_run_at) return 'delayed'
  const age = now.getTime() - new Date(h.last_run_at).getTime()
  return age > 45 * 60_000 ? 'delayed' : 'healthy'
}
