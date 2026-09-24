// SIGNAL-1: the SIGNAL$ values in a project unlock only for a report the
// account actually has (lib/deed/report-access.ts).
// Run: node --experimental-strip-types scripts/validate-signal-report-access.mts
import assert from 'node:assert/strict'
import { NO_ACCESS, decideReportAccess, sessionsToCheck, type ClaimRow, type QueueRow } from '../lib/deed/report-access.ts'

const q = (over: Partial<QueueRow>): QueueRow => ({
  id: 'q1', status: 'pending', stripe_session_id: 'cs_live_a', report_pdf_url: null,
  created_at: '2026-09-09T12:00:00Z', delivered_at: null, ...over,
})
const claim = (over: Partial<ClaimRow>): ClaimRow => ({
  id: 'c1', status: 'pending', report_pdf_url: null, created_at: '2026-09-18T12:00:00Z', delivered_at: null, ...over,
})

let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${n} ${name}`) }

t('an abandoned checkout (pending queue row, no purchase) stays locked', () => {
  assert.deepEqual(decideReportAccess([q({})], [], []), NO_ACCESS)
})

t('a paid session unlocks as pending until the PDF is delivered', () => {
  const d = decideReportAccess([q({})], [{ stripe_session_id: 'cs_live_a', revoked_at: null }], [])
  assert.equal(d.unlocked, true)
  assert.equal(d.status, 'pending')
  assert.equal(d.source, 'purchase')
  assert.equal(d.report_url, null)
})

t('a delivered row unlocks with its PDF link', () => {
  const d = decideReportAccess([q({ status: 'delivered', report_pdf_url: 'https://x/r.pdf', delivered_at: '2026-09-09T12:05:00Z' })], [], [])
  assert.equal(d.unlocked, true)
  assert.equal(d.status, 'delivered')
  assert.equal(d.report_url, 'https://x/r.pdf')
})

t('a revoked (refunded) purchase locks again, even when delivered', () => {
  const d = decideReportAccess([q({ status: 'delivered', report_pdf_url: 'https://x/r.pdf' })], [{ stripe_session_id: 'cs_live_a', revoked_at: '2026-09-10T00:00:00Z' }], [])
  assert.deepEqual(d, NO_ACCESS)
})

t('another session being paid does not unlock this one', () => {
  assert.deepEqual(decideReportAccess([q({})], [{ stripe_session_id: 'cs_live_other', revoked_at: null }], []), NO_ACCESS)
})

t('a subscriber claim unlocks', () => {
  const d = decideReportAccess([], [], [claim({})])
  assert.equal(d.unlocked, true)
  assert.equal(d.source, 'claim')
  assert.equal(d.status, 'pending')
  const done = decideReportAccess([], [], [claim({ status: 'delivered', report_pdf_url: 'https://x/c.pdf' })])
  assert.equal(done.status, 'delivered')
  assert.equal(done.report_url, 'https://x/c.pdf')
})

t('delivered beats pending, then the newest wins', () => {
  const d = decideReportAccess(
    [q({ id: 'old', status: 'delivered', report_pdf_url: 'https://x/old.pdf', created_at: '2026-08-01T00:00:00Z' })],
    [],
    [claim({ created_at: '2026-09-20T00:00:00Z' })],
  )
  assert.equal(d.status, 'delivered')
  assert.equal(d.report_url, 'https://x/old.pdf')
  const e = decideReportAccess([], [], [
    claim({ id: 'a', status: 'delivered', report_pdf_url: 'https://x/a.pdf', created_at: '2026-09-01T00:00:00Z' }),
    claim({ id: 'b', status: 'delivered', report_pdf_url: 'https://x/b.pdf', created_at: '2026-09-02T00:00:00Z' }),
  ])
  assert.equal(e.report_url, 'https://x/b.pdf')
})

t('only real session ids are sent to the purchases lookup, once each', () => {
  assert.deepEqual(sessionsToCheck([q({}), q({ id: 'q2' }), q({ id: 'q3', stripe_session_id: null }), q({ id: 'q4', stripe_session_id: '' })]), ['cs_live_a'])
})

console.log(`${n} passed`)
