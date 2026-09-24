// PARITY CP-5: the sent-alert export (lib/alerts/history.ts) — CSV escaping,
// formula defusing, calendar merge, status and health rules.
// Run: node --experimental-strip-types scripts/validate-alert-history.mts
import assert from 'node:assert/strict'
import { alertStatus, alertsCsv, csvCell, exportFilename, formatEt, healthState, mergeCalendars, sentAlert, singleCalendar, type NotificationRow } from '../lib/alerts/history.ts'

const ics = (watch: number, day: string) => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BidDeed.AI//Deed Watches//EN', 'METHOD:PUBLISH',
  'BEGIN:VEVENT', `UID:watch-${watch}-${day}@biddeed.ai`, 'DTSTAMP:20260923T144816Z', `DTSTART;VALUE=DATE:${day}`,
  `SUMMARY:Auction Brevard · CASE-${watch}`, 'END:VEVENT', 'END:VCALENDAR',
].join('\r\n')

const row = (over: Partial<NotificationRow>): NotificationRow => ({
  id: 1, watch_id: 5, alert_type: 'sale_date_change', subject: 'Sale date changed: Brevard · 05-2018-CA-017475-XXXX-XX',
  body_text: 'The sale date changed from 2026-10-07 to 2026-09-30.\n\nManage your watches: https://biddeed.ai/alerts',
  ics: ics(5, '20260930'), send_status: 'sent', resend_id: 'abc-123', last_error: null,
  created_at: '2026-09-23T14:48:16.108Z', sent_at: '2026-09-23T14:48:22.102Z',
  auction_watches: { case_number: '05-2018-CA-017475-XXXX-XX', county: 'brevard' },
  ...over,
})

let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${n} ${name}`) }

t('status: sent needs a Resend id', () => {
  assert.equal(alertStatus({ send_status: 'sent', resend_id: 'x' }), 'sent')
  assert.equal(alertStatus({ send_status: 'sent', resend_id: null }), 'sending')
  assert.equal(alertStatus({ send_status: 'queued', resend_id: null }), 'sending')
  assert.equal(alertStatus({ send_status: 'failed', resend_id: null }), 'failed')
})

t('sentAlert maps the row and never carries a recipient', () => {
  const a = sentAlert(row({ auction_watches: [{ case_number: 'C1', county: 'orange' }] }))
  assert.equal(a.case_number, 'C1')
  assert.equal(a.county, 'orange')
  assert.equal(a.has_calendar, true)
  assert.equal(a.id, '1')
  assert.ok(!('recipient' in a))
})

t('formatEt is Eastern time with a label', () => {
  assert.equal(formatEt('2026-09-23T14:48:22.102Z'), '2026-09-23 10:48 ET')
  assert.equal(formatEt('2026-01-15T05:05:00Z'), '2026-01-15 00:05 ET') // EST, midnight is 00 not 24
  assert.equal(formatEt(null), '')
  assert.equal(formatEt('nope'), '')
})

t('csvCell quotes and defuses formulas', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"')
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell('+1'), "'+1")
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(csvCell('-2'), "'-2")
  assert.equal(csvCell(null), '')
  assert.equal(csvCell('05-2018-CA-017475-XXXX-XX'), '05-2018-CA-017475-XXXX-XX')
})

t('alertsCsv: BOM, header, one line per alert, CRLF', () => {
  const csv = alertsCsv([sentAlert(row({})), sentAlert(row({ id: 2, send_status: 'failed', resend_id: null, sent_at: null }))])
  assert.ok(csv.startsWith('\uFEFFsent_at_et,case_number,county,alert,status,subject,message,delivery_id\r\n'))
  const body = csv.slice(1)
  assert.ok(body.includes('2026-09-23 10:48 ET,05-2018-CA-017475-XXXX-XX,brevard,Sale date change,sent,'))
  assert.ok(body.includes(',failed,'))
  assert.ok(body.endsWith('\r\n'))
  // The message has a newline, so it is quoted and the row still parses.
  assert.ok(body.includes('"The sale date changed from 2026-10-07 to 2026-09-30.\n\nManage your watches: https://biddeed.ai/alerts"'))
  assert.equal(alertsCsv([]), '\uFEFFsent_at_et,case_number,county,alert,status,subject,message,delivery_id\r\n')
})

t('mergeCalendars keeps the latest date per watch and dedupes UIDs', () => {
  const merged = mergeCalendars([
    { watch_id: 5, ics: ics(5, '20260930') },        // newest for watch 5
    { watch_id: 5, ics: ics(5, '20261007') },        // older date, same watch: left out
    { watch_id: 7, ics: ics(7, '20261015').replace(/\r\n/g, '\n') }, // LF-only input is normalised
    { watch_id: 8, ics: null },
    { watch_id: 9, ics: 'garbage' },
  ])
  assert.equal((merged.match(/BEGIN:VEVENT/g) ?? []).length, 2)
  assert.ok(merged.includes('UID:watch-5-20260930@biddeed.ai'))
  assert.ok(!merged.includes('20261007'))
  assert.ok(merged.includes('UID:watch-7-20261015@biddeed.ai'))
  assert.ok(merged.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'))
  assert.ok(merged.endsWith('END:VCALENDAR\r\n'))
  assert.ok(!/[^\r]\n/.test(merged), 'every line ends in CRLF')
  const empty = mergeCalendars([])
  assert.equal(empty.includes('BEGIN:VEVENT'), false)
  assert.ok(empty.includes('END:VCALENDAR'))
})

t('singleCalendar normalises line ends', () => {
  const one = singleCalendar(ics(5, '20260930').replace(/\r\n/g, '\n'))
  assert.ok(one.endsWith('END:VCALENDAR\r\n'))
  assert.ok(!/[^\r]\n/.test(one))
})

t('exportFilename uses the Eastern date', () => {
  const late = new Date('2026-09-24T02:30:00Z') // 10:30 PM ET on the 23rd
  assert.equal(exportFilename('csv', late), 'biddeed-alerts-2026-09-23.csv')
  assert.equal(exportFilename('ics', late), 'biddeed-auction-dates-2026-09-23.ics')
  assert.equal(exportFilename('ics', late, '42'), 'biddeed-alert-42.ics')
})

t('healthState', () => {
  const now = new Date('2026-09-24T01:30:00Z')
  const base = { active: true, schedule: '*/15 * * * *', last_status: 'succeeded', runs_24h: 96, failed_24h: 0 }
  assert.equal(healthState(null, now), 'unknown')
  assert.equal(healthState({ ...base, last_run_at: '2026-09-24T01:15:00Z' }, now), 'healthy')
  assert.equal(healthState({ ...base, last_run_at: '2026-09-24T00:30:00Z' }, now), 'delayed')
  assert.equal(healthState({ ...base, last_run_at: null }, now), 'delayed')
  assert.equal(healthState({ ...base, last_run_at: '2026-09-24T01:15:00Z', last_status: 'failed' }, now), 'failing')
  assert.equal(healthState({ ...base, last_run_at: '2026-09-24T01:15:00Z', active: false }, now), 'failing')
})

console.log(`alert-history: ${n} checks passed`)
