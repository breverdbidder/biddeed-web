import { test, expect, type Page } from '@playwright/test'

import { A, apiJson, haveCreds, signIn } from './helpers/clerk'

/**
 * PIONEER PROMISE PARITY — the signed-in half of the promise matrix
 * (docs/intent/PIONEER_PROMISE_PARITY_META_PROMPT.md in cli-anything-biddeed,
 * tracking issue 20518, checkpoints PROMISE-0..15).
 *
 * A Pioneer pays $990/year for tier `pro`. Pro's first checkmark is
 * "Everything in Investor" and Investor inherits Free, so this suite walks
 * every line the pricing page prints for those three tiers and asks one
 * question per line: does a signed-in Pro actually get it, on a real property
 * that is on the auction calendar right now?
 *
 * The run log IS the report. Every check prints one
 *   PROMISE <id> <PASS|FAIL> — <numbers>
 * line, so the workflow summary can be read without opening a trace. Checks
 * use soft assertions so one red promise never hides the nine behind it.
 *
 * Tier: .github/workflows/pioneer-promise.yml grants this account tier `pro`
 * with the service key before the suite and reverts it in an always() step.
 * No secret enters the test; the suite only observes what the app returns.
 */

// Real auctions, pulled from public.multi_county_auctions on 2026-09-18.
// Named fixtures, not "the first row", so a failure names a property someone
// can open in a browser.
const TP1 = {
  id: 'c75fb9db-77d9-4fe4-b9d5-f1c07f4c846f',
  county: 'broward',
  address: '18126 SW 29 ST',
  plaintiff: 'SILVERLAKES',
}
const TP3 = {
  id: 'f8578fa2-3fa8-4851-b92e-aedcb1e3239a',
  county: 'brevard',
  address: '1684 SHAMROCK AVE',
  plaintiff: 'LOANDEPOT',
}

// The eight fields the Pro tier prints under "Full ZoneWise zoning per
// property". Checked by name against what the auction detail API returns.
const PROMISED_ZONING_FIELDS = [
  'setbacks',
  'parking',
  'height',
  'land use',
  'units per acre',
  'FAR',
  'permitted uses',
  'overlays',
] as const

// The route builder only accepts UUID stop ids (parseBuildBody filters on the
// same shape), so the candidate ids are screened here rather than sending the
// builder something it will reject and calling that a broken feature.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function promise(id: string, pass: boolean, evidence: string) {
  console.log(`PROMISE ${id} ${pass ? 'PASS' : 'FAIL'} — ${evidence}`)
}

test.describe('Pioneer promise walk — signed in at Pro', () => {
  // Default mode, deliberately NOT serial. Serial was the first instinct
  // because every check shares one signed-in page, but serial SKIPS the rest
  // of the block after the first failure: run 35356567768 stopped at check 5
  // of 13 the moment the zoning promise went red, and the eight checks behind
  // it never ran. The whole point of this suite is a complete matrix, so one
  // red promise must never hide the ones after it. Default mode keeps the
  // shared page and the declared order, and runs every check.
  test.describe.configure({ retries: 0 })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    test.skip(!haveCreds, 'E2E_USER_* secrets are not configured for this run')
    page = await browser.newPage()
    await signIn(page, A.email as string, A.password as string)
  })

  test.afterAll(async () => {
    await page?.close()
  })

  test('PM-TIER the signed-in account resolves as Pro', async () => {
    // /api/d4d/routes answers 402 with the resolved tier in the body when the
    // caller is not entitled, so it doubles as the tier probe: a Pioneer must
    // never see 402 here.
    const res = await apiJson(page, '/api/d4d/routes')
    const body = res.body as { tierId?: string; routes?: unknown[] } | null
    const pass = res.status === 200
    promise(
      'PM-TIER',
      pass,
      `GET /api/d4d/routes -> ${res.status}${res.status === 402 ? ` (resolved tier: ${body?.tierId ?? 'unknown'})` : ''}`
    )
    expect.soft(res.status, 'a Pioneer must be entitled to D4D routes').toBe(200)
  })

  test('PM-F1 the 30-day calendar snapshot covers every county it claims', async () => {
    const summary = await apiJson(page, '/api/auctions/summary')
    const s = summary.body as { upcoming?: number; counties_upcoming?: number; counties?: number } | null
    const list = await apiJson(page, '/api/auctions?limit=5')
    const rows = ((list.body as { data?: unknown[] } | null)?.data ?? []).length

    const pass = summary.status === 200 && (s?.upcoming ?? 0) > 0 && rows > 0
    promise(
      'PM-F1',
      pass,
      `summary ${summary.status}: ${s?.upcoming ?? 0} upcoming across ${s?.counties_upcoming ?? 0} of ${s?.counties ?? 0} counties; /api/auctions returned ${rows} rows`
    )
    expect.soft(summary.status).toBe(200)
    expect.soft(rows).toBeGreaterThan(0)
  })

  test('PM-F3 the published number is on the named property', async () => {
    const res = await apiJson(page, `/api/auctions/${TP3.id}`)
    const a = (res.body as { auction?: Record<string, unknown> } | null)?.auction ?? (res.body as Record<string, unknown> | null)
    const opening = a?.opening_bid ?? null
    const judgment = a?.judgment_amount ?? null
    const pass = res.status === 200 && (opening !== null || judgment !== null)
    promise(
      'PM-F3',
      pass,
      `${TP3.address} (${TP3.county}) -> ${res.status}; opening_bid=${String(opening)} judgment_amount=${String(judgment)}`
    )
    expect.soft(res.status).toBe(200)
  })

  test('PM-I4 plaintiff identity is on the named property', async () => {
    const res = await apiJson(page, `/api/auctions/${TP3.id}`)
    const a = (res.body as { auction?: Record<string, unknown> } | null)?.auction ?? (res.body as Record<string, unknown> | null)
    const plaintiff = typeof a?.plaintiff === 'string' ? a.plaintiff : ''
    const pass = plaintiff.toUpperCase().includes(TP3.plaintiff)
    promise('PM-I4', pass, `${TP3.address}: plaintiff=${plaintiff || '(none)'} (expected to contain ${TP3.plaintiff})`)
    expect.soft(plaintiff, 'the deal page must name the plaintiff it promises').not.toBe('')
  })

  test('PM-P2 the eight promised ZoneWise fields on a real parcel', async () => {
    const res = await apiJson(page, `/api/auctions/${TP1.id}`)
    const zoning = (res.body as { zoning?: Record<string, unknown> | null } | null)?.zoning ?? null
    const serialized = JSON.stringify(zoning ?? {}).toLowerCase()
    const present = PROMISED_ZONING_FIELDS.filter((f) => serialized.includes(f.toLowerCase().replace(/ /g, '_')) || serialized.includes(f.toLowerCase()))
    const pass = present.length === PROMISED_ZONING_FIELDS.length
    promise(
      'PM-P2',
      pass,
      `${TP1.address} (${TP1.county}): ${present.length}/8 promised fields present${present.length ? ` [${present.join(', ')}]` : ''}; zoning payload ${zoning ? 'present' : 'null'}`
    )
    expect.soft(present.length, 'all eight printed zoning fields must be delivered').toBe(PROMISED_ZONING_FIELDS.length)
  })

  test('PM-I3 property cards are not capped for a Pioneer', async () => {
    const ids: string[] = []
    const list = await apiJson(page, '/api/auctions?limit=12')
    for (const row of ((list.body as { data?: { id?: string }[] } | null)?.data ?? [])) {
      if (row?.id) ids.push(row.id)
    }
    let ok = 0
    let firstBadStatus = 0
    for (const id of ids.slice(0, 10)) {
      const res = await apiJson(page, `/api/auctions/${id}`)
      if (res.status === 200) ok += 1
      else if (!firstBadStatus) firstBadStatus = res.status
    }
    const pass = ids.length > 0 && ok === Math.min(ids.length, 10)
    promise('PM-I3', pass, `${ok}/${Math.min(ids.length, 10)} consecutive property cards returned 200${firstBadStatus ? `; first non-200 was ${firstBadStatus}` : ''}`)
    expect.soft(ok, 'unlimited property cards must not start refusing').toBe(Math.min(ids.length, 10))
  })

  test('PM-P1 a D4D route builds from real calendar lots', async () => {
    const candidates = await apiJson(page, `/api/d4d/candidates?county=${TP3.county}`)
    const lots = ((candidates.body as { candidates?: Record<string, unknown>[] } | null)?.candidates ?? [])
    // The route builder takes `mcaIds`, not `stops` — run 35357344330 sent the
    // wrong shape and read the resulting 400 as a broken feature. A promise
    // test that cries wolf is worse than no test, so the payload is taken from
    // parseBuildBody in app/api/d4d/routes/route.ts.
    const stopIds = lots.slice(0, 3).map((l) => String(l.mca_id ?? l.id ?? '')).filter((v) => UUID_RE.test(v))

    let buildStatus = 0
    let buildNote = 'not attempted'
    if (stopIds.length >= 2) {
      const build = await apiJson(page, '/api/d4d/routes', {
        method: 'POST',
        body: JSON.stringify({ name: `PROMISE-7 proof ${Date.now()}`, county: TP3.county, mcaIds: stopIds }),
      })
      buildStatus = build.status
      buildNote = JSON.stringify(build.body).slice(0, 200)
    }
    const pass = candidates.status === 200 && lots.length > 0 && (buildStatus === 200 || buildStatus === 201)
    promise(
      'PM-P1',
      pass,
      `candidates ${candidates.status}: ${lots.length} drivable lots in ${TP3.county}; build -> ${buildStatus || 'skipped'} ${buildNote}`
    )
    expect.soft(candidates.status).toBe(200)
    expect.soft(lots.length, 'a Pioneer must have lots to drive').toBeGreaterThan(0)
  })

  test('PM-P4b three county monitors, and the fourth is capped', async () => {
    // /api/alerts/counties, not /api/alerts/watches: watches are per CASE
    // NUMBER, which needs you to already know the case. The printed promise is
    // three COUNTY monitors. Cleaning up first keeps the check idempotent
    // across runs, since the cap is the whole point of it.
    for (const county of ['brevard', 'broward', 'orange', 'polk']) {
      await apiJson(page, `/api/alerts/counties?county=${county}`, { method: 'DELETE' })
    }
    const created: number[] = []
    for (const county of ['brevard', 'broward', 'orange']) {
      const res = await apiJson(page, '/api/alerts/counties', { method: 'POST', body: JSON.stringify({ county }) })
      created.push(res.status)
    }
    const fourth = await apiJson(page, '/api/alerts/counties', { method: 'POST', body: JSON.stringify({ county: 'polk' }) })
    const list = await apiJson(page, '/api/alerts/counties')
    const active = ((list.body as { monitors?: unknown[] } | null)?.monitors ?? []).length
    const pass = created.every((s) => s === 200 || s === 201) && fourth.status === 402 && active === 3
    promise(
      'PM-P4b',
      pass,
      `three creates -> [${created.join(', ')}]; fourth -> ${fourth.status} (402 expected on a 3-monitor plan); active monitors now ${active}`
    )
    expect.soft(created.every((s) => s === 200 || s === 201), 'a Pioneer must be able to create three county monitors').toBe(true)
    expect.soft(fourth.status, 'the fourth must be refused, not silently allowed').toBe(402)
  })

  test('PM-P4a skip trace actually runs', async () => {
    const res = await apiJson(page, '/api/skip-trace', {
      method: 'POST',
      body: JSON.stringify({
        subject_type: 'property',
        subject_id: TP3.id,
        purpose: 'PROMISE-8 delivery proof for a paying Pro subscriber',
        consent_version: 'v1',
        requested_fields: ['name'],
      }),
    })
    const pass = res.status === 200
    promise('PM-P4a', pass, `POST /api/skip-trace -> ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`)
    expect.soft(res.status, 'a checkmarked skip trace must execute, not 503').toBe(200)
  })

  test('PM-I2 a Pioneer can claim one of the monthly SIGNAL$ reports', async () => {
    await page.goto('/buy-report', { waitUntil: 'domcontentloaded' })
    const text = (await page.locator('body').innerText()).toLowerCase()
    const chargesTwentyFive = text.includes('$25')
    const mentionsIncluded = /included in your plan|included with your|your plan includes|reports remaining|reports left this month/.test(text)
    const pass = mentionsIncluded && !chargesTwentyFive
    promise(
      'PM-I2',
      pass,
      `/buy-report as a signed-in Pioneer: charges $25 = ${chargesTwentyFive}; offers an included report = ${mentionsIncluded}. Pro prints "30 SIGNAL$ Property Reports a month".`
    )
    expect.soft(mentionsIncluded, 'a subscriber must have a way to consume the reports they paid for').toBe(true)
  })

  test('PM-F5 Ask Deed answers about a real property', async () => {
    const res = await apiJson(page, '/api/deed', {
      method: 'POST',
      body: JSON.stringify({
        county: TP3.county,
        messages: [{ role: 'user', content: `What is the opening bid on case ${TP3.address} in ${TP3.county} county?` }],
      }),
    })
    const raw = JSON.stringify(res.body ?? '')
    const pass = res.status === 200 && raw.length > 40
    promise('PM-F5', pass, `POST /api/deed -> ${res.status}; ${raw.length} chars back`)
    expect.soft(res.status).toBe(200)
  })

  test('PM-F6 / PM-I7 the Academy has the lessons it promises', async () => {
    await page.goto('/academy', { waitUntil: 'domcontentloaded' })
    const text = await page.locator('body').innerText()
    const named = ['lien priority', 'wipe rule', 'max-bid', 'case stud', 'ml verdict']
    const found = named.filter((n) => text.toLowerCase().includes(n))
    const pass = found.length === named.length
    promise(
      'PM-F6/I7',
      pass,
      `/academy: ${found.length}/${named.length} of the named Investor-level topics appear [${found.join(', ') || 'none'}]; page text ${text.length} chars`
    )
    expect.soft(found.length, 'every named Academy topic must exist').toBe(named.length)
  })

  test('PM-I5 the outcome scorecard shows completed sales', async () => {
    // /api/auctions has no status filter — it only ever answers about auctions
    // that have not happened yet, which is why run 35357344330 got five
    // upcoming rows and no outcomes. The scorecard is its own endpoint.
    const res = await apiJson(page, '/api/auctions/outcomes?days=180&limit=50')
    const body = res.body as { outcomes?: Record<string, unknown>[]; summary?: Record<string, unknown> } | null
    const rows = body?.outcomes ?? []
    const withOutcome = rows.filter((r) => r.sold_amount != null).length
    const summary = body?.summary ?? {}
    const pass = res.status === 200 && withOutcome > 0
    promise(
      'PM-I5',
      pass,
      `outcomes -> ${res.status}; ${rows.length} sales, ${withOutcome} with a sold amount; avg premium over opening ${String(summary.avg_premium_pct)}%, avg sold/assessed ${String(summary.avg_sold_to_assessed_pct)}%, winners ${JSON.stringify(summary.by_winner ?? {})}`
    )
    expect.soft(res.status, 'a Pioneer must be able to see completed sales').toBe(200)
    expect.soft(withOutcome, 'an outcome scorecard needs outcomes').toBeGreaterThan(0)
  })
})
