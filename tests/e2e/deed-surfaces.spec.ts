import { test, expect, type Browser, type Page } from '@playwright/test'

import { A, B, apiJson, haveCreds, signIn } from './helpers/clerk'

/**
 * PARITY CP-6 (Skills) and CP-8 (API keys), signed in, against E2E_BASE_URL.
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
 *
 * Nothing survives the run: the one skill it writes is deleted through the UI
 * (with an API delete in `finally` as the backstop), a free account never
 * reaches the run RPC so no run is logged, and the key create is refused
 * before any row is written. The ephemeral identities are deleted by the
 * workflow.
 */

const SYSTEM = ['lien_survival', 'surplus_check', 'zoning', 'comps', 'repair_estimate', 'max_bid']
const SKILLS = '/api/deed/skills'

type Library = { signed_in: boolean; can_run: boolean; skills: Array<{ id: string | null; slug: string; kind: string; name: string; mine: boolean; enabled: boolean; tools: string[] }> }

async function library(page: Page): Promise<Library> {
  const r = await apiJson(page, SKILLS)
  expect(r.status).toBe(200)
  return r.body as Library
}

test.describe('Deed Skills + API keys, signed in (PARITY CP-6 / CP-8)', () => {
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
})
