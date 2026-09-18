import { test, expect, type Browser } from '@playwright/test'

import { A, B, apiJson, haveCreds, signIn } from './helpers/clerk'

/**
 * PARITY CP-4 — Projects (#19847) against E2E_BASE_URL.
 *
 *   1. anon → 401 on every project route, and on a project-scoped chat turn
 *   2. create → upload (v1, v2) → cite (X-Deed-Cited names the file) → download
 *      (the signed URL serves the exact bytes) → rename → the page renders the
 *      project; account B sees 0 rows, 404 on open / upload / download / delete
 *   3. S1 — reopening after 10 minutes greets with what changed (a real
 *      10-minute wait; runs only when E2E_S1_WAIT=1, i.e. in playwright-rls.yml)
 *
 * 2 and 3 need the two Clerk E2E accounts and skip loudly without them; a 503
 * from /api/deed/projects means the CP-4 migration is not applied on that
 * environment yet and is reported as a skip with the reason.
 */

const ZERO_UUID = '00000000-0000-4000-8000-000000000000'
const PROJECTS = '/api/deed/projects'

function textFile(marker: string) {
  const text = `Deed of conveyance — test fixture ${marker}\nGrantor: Example Holdings LLC\nParcel: 24-36-01-AB-00001.0\nConsideration: $187,500\n`
  return { filename: `deed-notes-${marker}.txt`, mime_type: 'text/plain', data_base64: Buffer.from(text, 'utf8').toString('base64'), text }
}

test.describe('Deed Projects (PARITY CP-4)', () => {
  test('anon: every project route answers 401, and a project-scoped turn is refused', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    expect((await apiJson(page, PROJECTS)).status).toBe(401)
    expect((await apiJson(page, PROJECTS, { method: 'POST', body: JSON.stringify({ name: 'anon' }) })).status).toBe(401)
    expect((await apiJson(page, `${PROJECTS}/${ZERO_UUID}`)).status).toBe(401)
    expect((await apiJson(page, `${PROJECTS}/${ZERO_UUID}`, { method: 'PATCH', body: JSON.stringify({ name: 'x' }) })).status).toBe(401)
    expect((await apiJson(page, `${PROJECTS}/${ZERO_UUID}`, { method: 'DELETE' })).status).toBe(401)
    expect((await apiJson(page, `${PROJECTS}/${ZERO_UUID}/files`)).status).toBe(401)
    expect((await apiJson(page, `${PROJECTS}/${ZERO_UUID}/files`, { method: 'POST', body: JSON.stringify(textFile('anon')) })).status).toBe(401)
    expect((await apiJson(page, `${PROJECTS}/${ZERO_UUID}/files/${ZERO_UUID}`, { method: 'PATCH', body: JSON.stringify({ filename: 'x.txt' }) })).status).toBe(401)
    expect((await apiJson(page, `${PROJECTS}/${ZERO_UUID}/files/${ZERO_UUID}`, { method: 'DELETE' })).status).toBe(401)
    expect((await apiJson(page, `${PROJECTS}/${ZERO_UUID}/files/${ZERO_UUID}/download`)).status).toBe(401)
    const scoped = await apiJson(page, '/api/deed', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'What is in my project?' }], project_id: ZERO_UUID }),
    })
    expect(scoped.status).toBe(401)
  })

  test('create → upload → cite → download → other user sees nothing', async ({ browser }) => {
    test.skip(!haveCreds, 'Dedicated Clerk E2E credentials (E2E_USER_A/B_EMAIL, _PASSWORD) are not configured')
    test.setTimeout(240_000)
    const marker = `cp4${Date.now().toString(36)}`

    const ctxA = await (browser as Browser).newContext()
    const pageA = await ctxA.newPage()
    await signIn(pageA, A.email!, A.password!)
    await pageA.goto('/chat', { waitUntil: 'domcontentloaded' })

    // Create — county + a case number that does not exist in the SSOT, so no
    // sale is attached and the project is exactly what the body says.
    const created = await apiJson(pageA, PROJECTS, {
      method: 'POST',
      body: JSON.stringify({ county: 'brevard', case_number: `E2E-${marker}`, first_touch: { source: 'e2e', county: 'brevard', case: `E2E-${marker}` } }),
    })
    test.skip(created.status === 503, 'CP-4 migration not applied on this environment yet (projects route answered 503)')
    expect(created.status).toBe(201)
    const project = (created.body as { project: { id: string; name: string; county: string } }).project
    expect(project.county).toBe('brevard')
    expect(project.name).toContain('Brevard')
    const pid = project.id

    try {
      // Upload v1, then the same name again → v2. Text is extracted so Deed can cite it.
      const fixture = textFile(marker)
      const up1 = await apiJson(pageA, `${PROJECTS}/${pid}/files`, { method: 'POST', body: JSON.stringify(fixture) })
      expect(up1.status).toBe(201)
      const f1 = (up1.body as { file: { id: string; version: number; extraction_status: string } }).file
      expect(f1.version).toBe(1)
      expect(f1.extraction_status).toBe('ok')
      const up2 = await apiJson(pageA, `${PROJECTS}/${pid}/files`, { method: 'POST', body: JSON.stringify({ ...fixture, data_base64: Buffer.from(fixture.text + 'Amended.\n').toString('base64') }) })
      expect(up2.status).toBe(201)
      const f2 = (up2.body as { file: { id: string; version: number } }).file
      expect(f2.version).toBe(2)

      const files = await apiJson(pageA, `${PROJECTS}/${pid}/files`)
      expect(files.status).toBe(200)
      expect((files.body as { files: unknown[] }).files).toHaveLength(2)

      // Cite: the project-scoped turn names the file back in X-Deed-Cited
      // before the model says a word — the deterministic half of "cites the
      // file". The stream itself is read to the end so the Worker path is
      // exercised too.
      const cite = await pageA.evaluate(
        async ({ pid, marker }) => {
          const res = await fetch('/api/deed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: `In one sentence: what is the consideration in the attached deed notes for ${marker}? Cite the file by name.` }],
              project_id: pid,
              hook: 'home',
            }),
          })
          const cited = res.headers.get('x-deed-cited') || ''
          let text = ''
          if (res.ok && res.body) {
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              text += decoder.decode(value, { stream: true })
            }
          }
          return { status: res.status, cited: decodeURIComponent(cited), textLength: text.length, mentionsFile: text.includes(`deed-notes-${marker}.txt`), mentionsAmount: text.includes('187,500') }
        },
        { pid, marker }
      )
      expect(cite.status).toBe(200)
      expect(cite.cited).toBe(`deed-notes-${marker}.txt`)
      expect(cite.textLength).toBeGreaterThan(0)
      // Model prose is not a gate; it is recorded.
      test.info().annotations.push({ type: 'cite-prose', description: `mentionsFile=${cite.mentionsFile} mentionsAmount=${cite.mentionsAmount} chars=${cite.textLength}` })

      // Download v2 through the 10-minute signed URL: the bytes must be the bytes.
      const dl = await apiJson(pageA, `${PROJECTS}/${pid}/files/${f2.id}/download`)
      expect(dl.status).toBe(200)
      const { url, filename } = dl.body as { url: string; filename: string }
      expect(filename).toBe(fixture.filename)
      const fetched = await pageA.request.get(url)
      expect(fetched.status()).toBe(200)
      expect(await fetched.text()).toBe(fixture.text + 'Amended.\n')

      // Rename the latest version; the project name too.
      const renamed = await apiJson(pageA, `${PROJECTS}/${pid}/files/${f2.id}`, { method: 'PATCH', body: JSON.stringify({ filename: `deed-notes-${marker}-final.txt` }) })
      expect(renamed.status).toBe(200)
      const patched = await apiJson(pageA, `${PROJECTS}/${pid}`, { method: 'PATCH', body: JSON.stringify({ name: `E2E project ${marker}`, notes: 'Bid ceiling 210k.' }) })
      expect(patched.status).toBe(200)

      // The page: header, files row, and a fresh project shows no greeting yet.
      await pageA.goto(`/chat?project=${pid}`, { waitUntil: 'domcontentloaded' })
      await expect(pageA.locator('[data-project-panel="ready"]')).toBeVisible({ timeout: 30_000 })
      await expect(pageA.locator('[data-project-name]')).toHaveText(`E2E project ${marker}`)
      await expect(pageA.locator('[data-greeting="hidden"]')).toHaveCount(1)
      await pageA.getByRole('button', { name: /^Files \(/ }).click()
      await expect(pageA.locator(`[data-file="${f2.id}"]`)).toBeVisible()

      const detail = await apiJson(pageA, `${PROJECTS}/${pid}?peek=1`)
      expect(detail.status).toBe(200)
      const g = (detail.body as { greeting: { shown: boolean; minutes_since_last_visit: number } }).greeting
      expect(g.shown).toBe(false)
      expect(g.minutes_since_last_visit).toBeLessThan(10)

      // Account B: 0 rows, 404 everywhere — existence is never confirmed.
      const ctxB = await (browser as Browser).newContext()
      const pageB = await ctxB.newPage()
      await signIn(pageB, B.email!, B.password!)
      await pageB.goto('/chat', { waitUntil: 'domcontentloaded' })
      const listB = await apiJson(pageB, PROJECTS)
      expect(listB.status).toBe(200)
      expect(JSON.stringify(listB.body)).not.toContain(pid)
      expect((await apiJson(pageB, `${PROJECTS}/${pid}`)).status).toBe(404)
      expect((await apiJson(pageB, `${PROJECTS}/${pid}/files`)).status).toBe(404)
      expect((await apiJson(pageB, `${PROJECTS}/${pid}/files`, { method: 'POST', body: JSON.stringify(textFile('b')) })).status).toBe(404)
      expect((await apiJson(pageB, `${PROJECTS}/${pid}/files/${f2.id}/download`)).status).toBe(404)
      expect((await apiJson(pageB, `${PROJECTS}/${pid}/files/${f2.id}`, { method: 'DELETE' })).status).toBe(404)
      expect((await apiJson(pageB, `${PROJECTS}/${pid}`, { method: 'DELETE' })).status).toBe(404)
      const scopedB = await apiJson(pageB, '/api/deed', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'x' }], project_id: pid }) })
      expect(scopedB.status).toBe(404)
      await ctxB.close()

      // A still owns everything.
      expect((await apiJson(pageA, `${PROJECTS}/${pid}?peek=1`)).status).toBe(200)
    } finally {
      const gone = await apiJson(pageA, `${PROJECTS}/${pid}`, { method: 'DELETE' })
      expect(gone.status).toBe(200)
      expect((await apiJson(pageA, `${PROJECTS}/${pid}`)).status).toBe(404)
      await ctxA.close()
    }
  })

  test('S1: reopening after 10 minutes greets with what changed', async ({ browser }) => {
    test.skip(!haveCreds, 'Dedicated Clerk E2E credentials are not configured')
    test.skip(process.env.E2E_S1_WAIT !== '1', 'Real 10-minute wait — runs only with E2E_S1_WAIT=1 (playwright-rls.yml)')
    test.setTimeout(15 * 60_000)
    const marker = `s1${Date.now().toString(36)}`

    const ctxA = await (browser as Browser).newContext()
    const pageA = await ctxA.newPage()
    await signIn(pageA, A.email!, A.password!)
    await pageA.goto('/chat', { waitUntil: 'domcontentloaded' })
    const created = await apiJson(pageA, '/api/deed/projects', { method: 'POST', body: JSON.stringify({ county: 'brevard', name: `S1 ${marker}` }) })
    test.skip(created.status === 503, 'CP-4 migration not applied on this environment yet')
    expect(created.status).toBe(201)
    const pid = (created.body as { project: { id: string } }).project.id
    try {
      const startedAt = Date.now()
      // Ten minutes, for real. The clock is the server's last_viewed_at.
      await pageA.waitForTimeout(10 * 60_000 + 5_000)

      // Reopen the project page: the greeting renders, with real numbers.
      await pageA.goto(`/chat?project=${pid}`, { waitUntil: 'domcontentloaded' })
      await expect(pageA.locator('[data-project-panel="ready"]')).toBeVisible({ timeout: 30_000 })
      const greeting = pageA.locator('[data-greeting="shown"]')
      await expect(greeting).toBeVisible()
      const minutes = Number(await greeting.getAttribute('data-minutes'))
      expect(minutes).toBeGreaterThanOrEqual(10)
      const text = (await greeting.innerText()).replace(/\s+/g, ' ')
      expect(text).toMatch(/^Welcome back/)
      expect(text).toMatch(/Brevard sales? since you were here/)
      test.info().annotations.push({ type: 's1', description: `waited ${Math.round((Date.now() - startedAt) / 1000)} s; minutes=${minutes}; greeting: ${text}` })

      // That open consumed the window: the next read says so.
      const again = await apiJson(pageA, `/api/deed/projects/${pid}?peek=1`)
      expect(again.status).toBe(200)
      const g = (again.body as { greeting: { shown: boolean; minutes_since_last_visit: number } }).greeting
      expect(g.shown).toBe(false)
      expect(g.minutes_since_last_visit).toBeLessThan(10)
    } finally {
      await apiJson(pageA, `/api/deed/projects/${pid}`, { method: 'DELETE' })
      await ctxA.close()
    }
  })
})
