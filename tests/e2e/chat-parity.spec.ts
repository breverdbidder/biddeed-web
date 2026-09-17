import { test, expect, type Page } from '@playwright/test'

/**
 * PARITY CP-2 function proof — /chat on the application shell.
 *
 * Runs against E2E_BASE_URL (playwright.config.ts). Every model call is
 * intercepted: /api/deed answers with a canned SSE frame, so the suite spends
 * no inference and cannot flake on the Worker's rate limit — the transport
 * contract (lib/deed/protocol.ts) is what a real answer rides on, and it is
 * exercised end to end here. The live path is proven by the ui-audit harness
 * and the smoke checks, not by this file.
 *
 * "Recents survive reload" is asserted only when chat history is not
 * contained (issue #20226 → PARITY-3): while NEXT_PUBLIC_CHAT_HISTORY_CONTAINED
 * is on, the build stores nothing by design, and the test says so instead of
 * failing a deliberate privacy freeze.
 */

const SSE_ANSWER =
  'data: {"text":"Brevard runs its tax deed sales on the RealAuction platform. "}\n\n' +
  'data: {"text":"Check the opening bid, the title search and what survives the sale before you bid."}\n\n' +
  'data: [DONE]\n\n'

async function mockDeed(page: Page) {
  await page.route('**/api/deed', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: SSE_ANSWER,
    })
  })
}

test.describe('/chat on the AppShell (PARITY CP-2)', () => {
  test('renders the shell, the serif greeting, four Lucide chips and a labelled composer', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })

    // nextcss=1 — served by biddeed-web, not the Worker shell.
    await expect(page.locator('link[rel="stylesheet"][href*="/_next/static/css/"]').first()).toBeAttached()
    // The application shell: one <main>, the sidebar nav, the topbar toggle.
    await expect(page.locator('main#main')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Toggle navigation sidebar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'New chat' })).toBeVisible()

    await expect(page.getByRole('heading', { level: 1, name: 'What are we bidding on?' })).toBeVisible()
    const chips = page.getByRole('list', { name: 'Suggested questions' }).getByRole('button')
    await expect(chips).toHaveCount(4)
    // SVG icons, never pictographs, inside controls (G-ICONS).
    for (let i = 0; i < 4; i++) {
      await expect(chips.nth(i).locator('svg')).toHaveCount(1)
      expect(await chips.nth(i).innerText()).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }

    const box = page.getByRole('textbox', { name: /Ask Deed about Florida/ })
    await expect(box).toBeVisible()
    await expect(page.getByRole('button', { name: /Talk to Deed/ })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()

    // Nothing the Worker shell carried: no mascot empty state, no language row.
    await expect(page.locator('img[alt*="Deed" i]')).toHaveCount(0)
    expect(await page.locator('body').innerText()).not.toMatch(/Talk to Deed · Voice AI/)
  })

  test('a chip seeds the composer; sending renders the turn, streams the answer and puts ?c= in the URL', async ({ page }) => {
    await mockDeed(page)
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'How the max bid works' }).click()
    const box = page.getByRole('textbox', { name: /Ask Deed about Florida/ })
    await expect(box).toHaveValue(/maximum bid/)
    await page.getByRole('button', { name: 'Send message' }).click()

    await expect(page.getByText('How does BidDeed decide the maximum bid')).toBeVisible()
    await expect(page.getByText('Check the opening bid, the title search')).toBeVisible()
    await expect(page).toHaveURL(/\/chat\?c=[A-Za-z0-9-]+/)
    // The docked composer is the same component, ready for the follow-up.
    await expect(page.getByRole('textbox', { name: /Ask Deed about Florida/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible()
  })

  test('recents survive a reload (only asserted when chat history is not contained)', async ({ page }) => {
    await mockDeed(page)
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await page.getByRole('textbox', { name: /Ask Deed about Florida/ }).fill('What is selling in Brevard this week?')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText('Check the opening bid, the title search')).toBeVisible()
    await expect(page).toHaveURL(/\/chat\?c=/)

    const stored = await page.evaluate(() => {
      try {
        return localStorage.getItem('biddeed.deed.threads.v1')
      } catch {
        return null
      }
    })
    if (!stored) {
      test.info().annotations.push({
        type: 'contained',
        description: 'NEXT_PUBLIC_CHAT_HISTORY_CONTAINED is on (issue #20226): nothing is stored by design until PARITY-3.',
      })
      return
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('What is selling in Brevard this week?')).toBeVisible()
    await expect(page.getByRole('link', { name: /What is selling in Brevard/ })).toBeVisible()
  })

  test('#projects opens the Projects panel; ?new=1 starts clean', async ({ page }) => {
    await page.goto('/chat#projects', { waitUntil: 'domcontentloaded' })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Projects' })).toBeVisible()
    // Labelled "coming", never a locked wall (meta prompt CP-2 §1).
    expect(await dialog.innerText()).not.toMatch(/locked/i)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await page.goto('/chat?new=1', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByRole('heading', { level: 1, name: 'What are we bidding on?' })).toBeVisible()
  })

  test('the Auctions "start a project" link lands in the panel with the sale, and can seed the composer', async ({ page }) => {
    await page.goto('/chat?new_project_county=brevard&case=05-2026-CA-000123&source=radar_modal', {
      waitUntil: 'domcontentloaded',
    })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Brevard County · case 05-2026-CA-000123')).toBeVisible()
    await expect(page).toHaveURL(/\/chat$/)
    await dialog.getByRole('button', { name: 'Ask Deed about this sale' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('textbox', { name: /Ask Deed about Florida/ })).toHaveValue(/case 05-2026-CA-000123/)
  })

  test('the mic is voice, not a link: one press opens the email gate, no navigation', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    const mic = page.getByRole('button', { name: /Talk to Deed/ })
    await mic.click()
    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByRole('textbox', { name: /Your email address, to start the voice session/ })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('textbox', { name: /Your email address/ })).toHaveCount(0)
  })
})
