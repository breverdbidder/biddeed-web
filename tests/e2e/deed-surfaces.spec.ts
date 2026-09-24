import { test, expect, type Browser, type Page } from '@playwright/test'

import { A, B, apiJson, haveCreds, signIn } from './helpers/clerk'

/**
 * PARITY CP-6 (Skills), CP-8 (API keys) and CP-2 (chat recents), signed in,
 * against E2E_BASE_URL.
 *
 * Both surfaces were proven live at the database layer on 2026-09-23 (every
 * skill run on a real auction, a user skill saved / run / deleted, a key
 * created / used / revoked). What that could not show is the page a signed-in
 * customer actually sees, because the only Clerk identities live here in CI.
 * This spec is that proof, and it is read-mostly by design:
 *
 *   Skills   library signed in · author a SKILL.md through the panel · the
 *            tool order kept · the "/ menu" toggle · account B sees, changes
 *            and deletes nothing of A's · the Investor gate on a run (402 with
 *            the upgrade link, shown in the panel) · delete through the panel
 *   API keys the key page signed in, for an account without an API plan: the
 *            reason and the plans link are shown, and a create is refused
 *   Scheduled the sent-alert history (CP-5): listed on /alerts, CSV and
 *            calendar downloads, the job status line, owner-only by id
 *   Chat     one real conversation: saved under the account, back after a
 *            reload, found by the sidebar search, reopened, deleted; and a
 *            PDF attached in the composer, read and quoted in the answer
 *
 * What it writes, it removes: the one skill is deleted through the UI (API
 * delete in `finally` as the backstop), the key create is refused before any
 * row is written, and the one conversation is deleted from the sidebar (API
 * delete as the backstop). The one exception is a run on a paid identity: it
 * writes the same usage-log row any customer's run writes (a free identity is
 * stopped at the 402 before the run RPC). First run 2026-09-23 (run
 * 35930629828): identity A is on a paid plan, so the panel ran Lien survival
 * live.
 */

const SYSTEM = ['lien_survival', 'surplus_check', 'zoning', 'comps', 'repair_estimate', 'max_bid']
const SKILLS = '/api/deed/skills'

type Library = { signed_in: boolean; can_run: boolean; skills: Array<{ id: string | null; slug: string; kind: string; name: string; mine: boolean; enabled: boolean; tools: string[] }> }

/** A one-page PDF with plain Helvetica text: the smallest honest fixture for "Deed reads a PDF". */
function onePagePdf(lines: string[]): Buffer {
  const content = 'BT /F1 12 Tf 72 720 Td 16 TL ' + lines.map((l) => `(${l.replace(/[()\\]/g, '')} ) Tj T*`).join(' ') + ' ET'
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

async function library(page: Page): Promise<Library> {
  const r = await apiJson(page, SKILLS)
  expect(r.status).toBe(200)
  return r.body as Library
}

test.describe('Deed Skills, API keys and chat recents, signed in (PARITY CP-6 / CP-8 / CP-2)', () => {
  test('anon: the panel asks for sign-in and every write answers 401', async ({ page }) => {
    await page.goto('/chat#skills', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('dialog').getByText('Sign in to run skills.')).toBeVisible({ timeout: 20_000 })
    const lib = await library(page)
    expect(lib.signed_in).toBe(false)
    expect(lib.skills.map((s) => s.slug)).toEqual(expect.arrayContaining(SYSTEM))
    const zero = '00000000-0000-4000-8000-000000000000'
    expect((await apiJson(page, SKILLS, { method: 'POST', body: JSON.stringify({ spec_md: 'x' }) })).status).toBe(401)
    expect((await apiJson(page, `${SKILLS}/${zero}`, { method: 'PATCH', body: JSON.stringify({ enabled: false }) })).status).toBe(401)
    expect((await apiJson(page, `${SKILLS}/${zero}`, { method: 'DELETE' })).status).toBe(401)
    expect((await apiJson(page, `${SKILLS}/run`, { method: 'POST', body: JSON.stringify({ skill: 'zoning', county: 'brevard', case_number: '05-2025-CA-052707' }) })).status).toBe(401)
    // /api/developer/* sits behind the Clerk middleware: a signed-out caller is sent to sign-in, never served.
    const keys = await page.request.get('/api/developer/keys', { maxRedirects: 0 })
    expect([401, 307]).toContain(keys.status())
    if (keys.status() === 307) expect(keys.headers()['location'] ?? '').toContain('/sign-in')
  })

  test('skills: author → isolation → Investor gate → delete, through the panel', async ({ browser }) => {
    test.skip(!haveCreds, 'Clerk E2E identities (E2E_USER_A/B_*) are not configured')
    test.setTimeout(240_000)
    const marker = `e2e${Date.now().toString(36)}`
    const name = `Pre-bid ${marker}`
    const spec = [
      '---',
      `name: ${name}`,
      'description: Liens, max-bid facts and comps before I register to bid.',
      'tools: [lien_survival, max_bid, comps]',
      '---',
      'Stop if any lien SURVIVES. Otherwise compare the plaintiff max bid with the comps median.',
      '',
    ].join('\n')

    const ctxA = await (browser as Browser).newContext()
    const pageA = await ctxA.newPage()
    let createdId: string | null = null
    try {
      await signIn(pageA, A.email!, A.password!)
      await pageA.goto('/chat#skills', { waitUntil: 'domcontentloaded' })
      const panel = pageA.getByRole('dialog')
      await expect(panel.getByRole('form', { name: 'Run a skill' })).toBeVisible({ timeout: 20_000 })
      await expect(panel.getByText('Sign in to run skills.')).toHaveCount(0)

      const before = await library(pageA)
      expect(before.signed_in).toBe(true)
      expect(before.skills.filter((s) => s.kind === 'system').map((s) => s.slug)).toEqual(expect.arrayContaining(SYSTEM))
      if (!before.can_run) await expect(panel.getByText('Skills run on Investor and above.')).toBeVisible()

      // Author through the panel: the live preview names the tool chain before saving.
      await panel.getByRole('button', { name: 'Create a skill' }).click()
      await panel.locator('#skill-md').fill(spec)
      await expect(panel.getByText(`Will save ${name}, running Lien survival → Max bid → Comparable sales.`)).toBeVisible()
      await panel.getByRole('button', { name: 'Save skill' }).click()
      const item = panel.getByRole('list', { name: 'Skills library' }).getByRole('listitem').filter({ hasText: name })
      await expect(item).toBeVisible({ timeout: 20_000 })
      await expect(item.getByText('Yours')).toBeVisible()

      const saved = (await library(pageA)).skills.find((s) => s.name === name)
      expect(saved, 'the saved skill is in A’s library').toBeTruthy()
      createdId = saved!.id
      expect(saved!.mine).toBe(true)
      expect(saved!.kind).toBe('user')
      expect(saved!.tools).toEqual(['lien_survival', 'max_bid', 'comps'])

      // The "In / menu" switch persists.
      await item.getByRole('checkbox').uncheck()
      await expect.poll(async () => (await library(pageA)).skills.find((s) => s.id === createdId)?.enabled).toBe(false)
      await item.getByRole('checkbox').check()
      await expect.poll(async () => (await library(pageA)).skills.find((s) => s.id === createdId)?.enabled).toBe(true)

      // Account B: never sees it, cannot change or delete it (404, existence not confirmed).
      const ctxB = await (browser as Browser).newContext()
      const pageB = await ctxB.newPage()
      try {
        await signIn(pageB, B.email!, B.password!)
        await pageB.goto('/chat', { waitUntil: 'domcontentloaded' })
        const libB = await library(pageB)
        expect(libB.signed_in).toBe(true)
        expect(libB.skills.some((s) => s.id === createdId || s.name === name)).toBe(false)
        expect((await apiJson(pageB, `${SKILLS}/${createdId}`, { method: 'PATCH', body: JSON.stringify({ enabled: false }) })).status).toBe(404)
        expect((await apiJson(pageB, `${SKILLS}/${createdId}`, { method: 'DELETE' })).status).toBe(404)
      } finally {
        await ctxB.close()
      }
      expect((await library(pageA)).skills.find((s) => s.id === createdId)?.enabled, 'B’s attempts changed nothing').toBe(true)

      // Run from the panel. A free account gets the Investor gate with the plans link;
      // a paid one gets the tool results.
      await panel.locator('#skill-select').selectOption('lien_survival')
      await panel.locator('#skill-county').selectOption('brevard')
      await panel.locator('#skill-case').fill('05-2025-CA-052707')
      await panel.getByRole('button', { name: 'Run skill' }).click()
      if (!before.can_run) {
        const alert = panel.getByRole('alert')
        await expect(alert).toContainText('Skills run on Investor and above.', { timeout: 30_000 })
        await expect(alert.getByRole('link', { name: 'See the plans' })).toHaveAttribute('href', '/subscribe?tier=investor')
        const gated = await apiJson(pageA, `${SKILLS}/run`, {
          method: 'POST',
          body: JSON.stringify({ skill: 'lien_survival', county: 'brevard', case_number: '05-2025-CA-052707' }),
        })
        expect(gated.status).toBe(402)
        expect((gated.body as { code?: string; upgrade_url?: string }).code).toBe('PAID_TIER_REQUIRED')
        expect((gated.body as { upgrade_url?: string }).upgrade_url).toBe('/subscribe?tier=investor')
      } else {
        await expect(panel.getByRole('region', { name: 'Lien survival' })).toBeVisible({ timeout: 60_000 })
      }

      // The / menu on /chat lists the skills commands for a signed-in customer too.
      await pageA.keyboard.press('Escape')
      const box = pageA.locator('textarea').first()
      await box.click()
      await box.fill('/')
      await expect(pageA.locator('#chat-slash-menu')).toContainText('/skills')
      await box.fill('')

      // Delete through the panel.
      await pageA.goto('/chat#skills', { waitUntil: 'domcontentloaded' })
      const again = pageA.getByRole('dialog').getByRole('list', { name: 'Skills library' }).getByRole('listitem').filter({ hasText: name })
      await expect(again).toBeVisible({ timeout: 20_000 })
      await again.getByRole('button', { name: `Delete ${name}` }).click()
      await expect(again).toHaveCount(0, { timeout: 20_000 })
      expect((await library(pageA)).skills.some((s) => s.id === createdId)).toBe(false)
      createdId = null
    } finally {
      if (createdId) await apiJson(pageA, `${SKILLS}/${createdId}`, { method: 'DELETE' }).catch(() => undefined)
      await ctxA.close()
    }
  })

  test('chat (CP-2): a signed-in conversation survives a reload, is searchable, reopens and deletes', async ({ browser }) => {
    test.skip(!haveCreds, 'Clerk E2E identities (E2E_USER_A/B_*) are not configured')
    test.setTimeout(240_000)
    const marker = `e2e${Date.now().toString(36)}`
    // Under 48 characters, so the sidebar title is the question itself.
    const question = `${marker}: what sells in Brevard this week?`
    const ctx = await (browser as Browser).newContext()
    const page = await ctx.newPage()
    let threadId: string | null = null
    try {
      await signIn(page, A.email!, A.password!)
      // Every /api/deed response on this page, so a failed answer says why.
      const deedCalls: string[] = []
      page.on('response', (r) => {
        if (/\/api\/deed(\?|$)/.test(r.url())) deedCalls.push(`${r.request().method()} ${r.status()} ${r.headers()['content-type'] ?? ''}`)
      })
      await page.goto('/chat', { waitUntil: 'domcontentloaded' })
      await page.getByRole('textbox', { name: /Ask Deed about Florida/ }).fill(question)
      // What the page does after Send: navigations, full loads, non-200 RSC
      // fetches and console errors (a first message once vanished with no
      // /api/deed call at all, leaving ?c= on an empty page).
      const afterSend: string[] = []
      page.on('framenavigated', (f) => {
        if (f === page.mainFrame()) afterSend.push(`nav ${new URL(f.url()).pathname}${new URL(f.url()).search}`)
      })
      page.on('load', () => afterSend.push('full-load'))
      page.on('response', (r) => {
        if (r.url().includes('_rsc=') && r.status() !== 200) afterSend.push(`rsc ${r.status()}`)
      })
      page.on('console', (m) => {
        if (m.type() === 'error') afterSend.push(`console ${m.text().slice(0, 140)}`)
      })
      const t0 = Date.now()
      const deedPath = (u: string) => new URL(u).pathname.startsWith('/api/deed')
      page.on('request', (r) => {
        if (deedPath(r.url())) afterSend.push(`req ${r.method()} ${new URL(r.url()).pathname} +${Date.now() - t0}ms`)
      })
      page.on('requestfailed', (r) => {
        if (deedPath(r.url())) afterSend.push(`failed ${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText ?? ''} +${Date.now() - t0}ms`)
      })
      page.on('response', (r) => {
        if (deedPath(r.url()) && !/\/api\/deed(\?|$)/.test(r.url())) afterSend.push(`res ${r.request().method()} ${new URL(r.url()).pathname} ${r.status()} +${Date.now() - t0}ms`)
      })
      const clerkAtSend = await page.evaluate(() => {
        const c = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown } }).Clerk
        return `clerk loaded=${Boolean(c?.loaded)} user=${Boolean(c?.user)}`
      })
      afterSend.push(clerkAtSend)
      await page.getByRole('button', { name: 'Send message' }).click()
      await expect(page).toHaveURL(/\/chat\?c=[A-Za-z0-9-]+/, { timeout: 30_000 })
      threadId = new URL(page.url()).searchParams.get('c')
      expect(threadId).toBeTruthy()
      // A real answer, streamed from the live model path. On a miss, the error
      // carries what the page showed and what /api/deed answered.
      const answered = await page
        .getByRole('button', { name: 'Copy' })
        .first()
        .waitFor({ state: 'visible', timeout: 90_000 })
        .then(() => true)
        .catch(() => false)
      if (!answered) {
        const shown = (await page.locator('#main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(-700)
        throw new Error(`No answer within 90 s. /api/deed: [${deedCalls.join(' | ')}]. After Send: [${afterSend.join(' | ')}]. Page: …${shown}`)
      }

      // Saved server-side under this account, not in the browser.
      await expect
        .poll(async () => JSON.stringify((await apiJson(page, '/api/deed/threads')).body), { timeout: 30_000 })
        .toContain(threadId!)

      // Reload: the recents come back from the server.
      await page.goto('/chat', { waitUntil: 'domcontentloaded' })
      const recent = page.locator(`a[href="/chat?c=${threadId}"]`)
      await expect(recent).toBeVisible({ timeout: 20_000 })
      await expect(recent).toContainText(marker)

      // Search your chats.
      const search = page.locator('#deed-thread-search')
      await search.fill(marker)
      await expect(recent).toBeVisible({ timeout: 15_000 })
      await search.fill(`zz${marker}nomatch`)
      await expect(page.getByText('No chats match')).toBeVisible({ timeout: 15_000 })
      await search.fill('')
      await expect(recent).toBeVisible({ timeout: 15_000 })

      // Reopen from recents: the turns are restored from the server.
      await recent.click()
      await expect(page).toHaveURL(new RegExp(`[?&]c=${threadId}`))
      // The question and the answer's Copy action, inside the conversation (not the sidebar title).
      await expect(page.locator('#main').getByText(question).first()).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('#main').getByRole('button', { name: 'Copy' }).first()).toBeVisible()

      // Delete from the sidebar.
      await recent.hover()
      await page.getByRole('button', { name: `Delete conversation “${question}”` }).click()
      await expect(recent).toHaveCount(0, { timeout: 15_000 })
      expect((await apiJson(page, `/api/deed/threads/${threadId}`)).status).toBe(404)
      threadId = null
    } finally {
      if (threadId) await apiJson(page, `/api/deed/threads/${threadId}`, { method: 'DELETE' }).catch(() => undefined)
      await ctx.close()
    }
  })

  test('chat (CP-2): a PDF attached in the composer is read and cited in the answer', async ({ browser }) => {
    test.skip(!haveCreds, 'Clerk E2E identities (E2E_USER_A/B_*) are not configured')
    test.setTimeout(240_000)
    const digits = String(Date.now()).slice(-6)
    // A parcel id that exists only inside this PDF: if it is in the answer, Deed read the file.
    const parcel = `24-36-01-QZ-${digits}.0`
    const pdf = onePagePdf([
      'Title search notes - E2E fixture',
      `Parcel ID: ${parcel}`,
      'Opening bid: $187,500',
      'First mortgage: Example Bank, recorded 2019',
    ])
    const ctx = await (browser as Browser).newContext()
    const page = await ctx.newPage()
    let threadId: string | null = null
    try {
      await signIn(page, A.email!, A.password!)
      const deedCalls: string[] = []
      page.on('response', (r) => {
        if (/\/api\/deed(\/upload)?(\?|$)/.test(r.url())) deedCalls.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`)
      })
      await page.goto('/chat', { waitUntil: 'domcontentloaded' })
      await page.locator('input[type="file"]').first().setInputFiles({ name: `title-notes-${digits}.pdf`, mimeType: 'application/pdf', buffer: pdf })
      await expect(page.getByText(`title-notes-${digits}.pdf — ready, Deed will cite it`)).toBeVisible({ timeout: 30_000 })

      await page.getByRole('textbox', { name: /Ask Deed about Florida/ }).fill('What is the parcel ID in the attached PDF? Quote it exactly.')
      await page.getByRole('button', { name: 'Send message' }).click()
      await expect(page).toHaveURL(/\/chat\?c=[A-Za-z0-9-]+/, { timeout: 30_000 })
      threadId = new URL(page.url()).searchParams.get('c')
      const cited = await page
        .locator('#main')
        .getByText(parcel)
        .first()
        .waitFor({ state: 'visible', timeout: 120_000 })
        .then(() => true)
        .catch(() => false)
      if (!cited) {
        const shown = (await page.locator('#main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(-700)
        throw new Error(`The answer never quoted ${parcel}. Calls: [${deedCalls.join(' | ')}]. Page: …${shown}`)
      }
    } finally {
      if (threadId) await apiJson(page, `/api/deed/threads/${threadId}`, { method: 'DELETE' }).catch(() => undefined)
      await ctx.close()
    }
  })

  test('API keys: the key page signed in, for an account without an API plan', async ({ browser }) => {
    test.skip(!haveCreds, 'Clerk E2E identities (E2E_USER_A/B_*) are not configured')
    test.setTimeout(120_000)
    const ctx = await (browser as Browser).newContext()
    const page = await ctx.newPage()
    try {
      await signIn(page, A.email!, A.password!)
      await page.goto('/account/developers', { waitUntil: 'domcontentloaded' })
      await expect(page).not.toHaveURL(/\/sign-in/)
      await expect(page.getByRole('heading', { level: 1, name: 'API keys' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByRole('heading', { name: 'Your key' })).toBeVisible()

      const listing = await apiJson(page, '/api/developer/keys')
      expect(listing.status).toBe(200)
      const l = listing.body as { customer: boolean; can_create: boolean; block_reason: string | null; keys: unknown[] }
      test.skip(l.can_create, 'This identity has an API plan; the no-plan proof needs a plain account')
      expect(l.block_reason).toBe('no_plan')
      expect(l.keys).toEqual([])
      await expect(page.getByText('API keys come with an API plan. Your account does not have one yet.')).toBeVisible()
      await expect(page.getByRole('link', { name: 'See the plans' })).toHaveAttribute('href', '/pricing')
      await expect(page.getByRole('button', { name: /Create key|Replace key/ })).toHaveCount(0)

      const refused = await apiJson(page, '/api/developer/keys', { method: 'POST', body: JSON.stringify({ confirm: 'create_key' }) })
      expect(refused.status).toBe(403)
      expect((refused.body as { reason?: string }).reason).toBe('no_plan')
      expect(((await apiJson(page, '/api/developer/keys')).body as { keys: unknown[] }).keys).toEqual([])
    } finally {
      await ctx.close()
    }
  })

  test('Scheduled (CP-5): sent alerts are listed and download as CSV and a calendar file, for the owner only', async ({ browser, page }) => {
    // Signed out, the history answers 401 like the rest of /api/alerts.
    await page.goto('/alerts', { waitUntil: 'domcontentloaded' })
    expect((await apiJson(page, '/api/alerts/history')).status).toBe(401)
    test.skip(!haveCreds, 'Clerk E2E identities (E2E_USER_A/B_*) are not configured')
    test.setTimeout(120_000)
    const ctx = await (browser as Browser).newContext({ acceptDownloads: true })
    const pageA = await ctx.newPage()
    try {
      await signIn(pageA, A.email!, A.password!)
      await pageA.goto('/alerts', { waitUntil: 'domcontentloaded' })
      await expect(pageA).not.toHaveURL(/\/sign-in/)

      type Sent = { id: string; case_number: string; status: string; has_calendar: boolean; delivery_id: string | null }
      const listing = await apiJson(pageA, '/api/alerts/history')
      expect(listing.status).toBe(200)
      const history = listing.body as { alerts: Sent[]; health: { active: boolean; last_status: string | null; last_run_at: string | null } | null }
      expect(Array.isArray(history.alerts)).toBe(true)
      // The address an alert went to is never part of what the page loads.
      expect(JSON.stringify(history)).not.toMatch(/recipient|@resend\.dev|notify_email/)
      // The job behind the page: on, and its last run succeeded.
      expect(history.health?.active).toBe(true)
      expect(history.health?.last_status).toBe('succeeded')

      const csv = await apiJson(pageA, '/api/alerts/history?format=csv')
      expect(csv.status).toBe(200)
      expect(csv.headers['content-type']).toContain('text/csv')
      expect(csv.headers['content-disposition']).toMatch(/^attachment; filename="biddeed-alerts-\d{4}-\d{2}-\d{2}\.csv"$/)
      const csvText = String((csv.body as { raw?: string }).raw ?? '')
      const csvLines = csvText.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l !== '')
      expect(csvLines[0]).toBe('sent_at_et,case_number,county,alert,status,subject,message,delivery_id')

      const ics = await apiJson(pageA, '/api/alerts/history?format=ics')
      expect(ics.status).toBe(200)
      expect(ics.headers['content-type']).toContain('text/calendar')
      const icsText = String((ics.body as { raw?: string }).raw ?? '')
      expect(icsText.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
      expect(icsText.trimEnd().endsWith('END:VCALENDAR')).toBe(true)

      // Another account's alert is not reachable by id (notification 1 is the
      // CP-5 proof account's), and an unknown format is refused.
      expect((await apiJson(pageA, '/api/alerts/history?format=ics&id=1')).status).toBe(404)
      expect((await apiJson(pageA, '/api/alerts/history?format=xml')).status).toBe(400)

      // The Scheduled page shows the same list and the job's status line.
      const panel = pageA.getByTestId('sent-alerts')
      await expect(panel.getByRole('heading', { name: 'Sent alerts' })).toBeVisible({ timeout: 20_000 })
      await expect(pageA.getByTestId('watch-health')).toHaveAttribute('data-state', 'healthy')
      if (history.alerts.length === 0) {
        await expect(panel.getByText(/Nothing sent yet/)).toBeVisible()
        test.info().annotations.push({ type: 'cp5', description: 'no sent alerts on this account yet: list, CSV header and empty calendar checked' })
        return
      }
      const newest = history.alerts[0]
      expect(csvLines.length).toBe(history.alerts.length + 1)
      expect(csvLines[1]).toContain(newest.case_number)
      await expect(panel.getByRole('listitem').first()).toContainText(newest.case_number)
      const [csvDownload] = await Promise.all([pageA.waitForEvent('download'), panel.getByRole('link', { name: 'Export CSV' }).click()])
      expect(csvDownload.suggestedFilename()).toMatch(/^biddeed-alerts-\d{4}-\d{2}-\d{2}\.csv$/)
      const withCalendar = history.alerts.find((a) => a.has_calendar)
      if (withCalendar) {
        expect(icsText).toContain('BEGIN:VEVENT')
        const [one] = await Promise.all([
          pageA.waitForEvent('download'),
          panel.getByRole('link', { name: `Calendar file for ${withCalendar.case_number}` }).first().click(),
        ])
        expect(one.suggestedFilename()).toMatch(/^biddeed-alert-\d+\.ics$/)
      }
      test.info().annotations.push({
        type: 'cp5',
        description: `${history.alerts.length} sent alert(s); newest ${newest.status}, Resend id ${newest.delivery_id ? 'present' : 'absent'}, calendar ${withCalendar ? 'downloaded' : 'none'}`,
      })
    } finally {
      await ctx.close()
    }
  })
})
