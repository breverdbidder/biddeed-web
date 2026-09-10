import { test, expect, type Page } from '@playwright/test'

/**
 * Privacy containment (issue #20226).
 *
 * These run against E2E_BASE_URL (defaults to https://staging.biddeed.ai, see
 * playwright.config.ts) and only exercise this app's own routes/UI — the
 * router Worker's identical containment (src/worker.js in cli-anything-
 * biddeed) has its own unit suite there (tests/chat-containment.test.js),
 * since the Worker's persistence routes don't exist on the staging Worker at
 * all (see docs/spec/20226.md) and testing them here would mean hitting the
 * production apex from CI, which this suite deliberately does not do.
 *
 * No live model call is made anywhere in this file — "anonymous chat keeps
 * working" is verified by code inspection + the Worker's own unit tests
 * (containedChatOwnerEmail resolves null but the request still proceeds),
 * not by spending real inference cost on every CI run.
 */

async function apiJson(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(
    async ({ path, init }) => {
      const response = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      })
      const text = await response.text()
      let body: unknown = null
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = { raw: text }
      }
      return { status: response.status, body }
    },
    { path, init }
  )
}

test.describe('Chat history privacy containment', () => {
  test('a clean browser has no Recent group and no legacy thread/identity data in storage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Recent', { exact: true })).toHaveCount(0)

    const storage = await page.evaluate(() => ({
      threads: localStorage.getItem('biddeed.deed.threads.v1'),
      chatToken: localStorage.getItem('bd_chat_token'),
      chatEmail: localStorage.getItem('bd_chat_email'),
    }))
    expect(storage.threads).toBeNull()
    expect(storage.chatToken).toBeNull()
    expect(storage.chatEmail).toBeNull()
  })

  test('a fabricated pre-containment localStorage thread is wiped on load, not just hidden', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem(
        'biddeed.deed.threads.v1',
        JSON.stringify([{ id: 'legacy-1', title: 'Old conversation', createdAt: 0, updatedAt: 0, turns: [] }])
      )
      localStorage.setItem('bd_chat_token', 'legacy.token.value')
      localStorage.setItem('bd_chat_email', 'someone@example.com')
    })
    await page.reload({ waitUntil: 'domcontentloaded' })

    const storage = await page.evaluate(() => ({
      threads: localStorage.getItem('biddeed.deed.threads.v1'),
      chatToken: localStorage.getItem('bd_chat_token'),
      chatEmail: localStorage.getItem('bd_chat_email'),
    }))
    expect(storage.threads).toBeNull()
    expect(storage.chatToken).toBeNull()
    expect(storage.chatEmail).toBeNull()
  })

  test('/?c=<id> never restores a thread — no docked composer, the marketing hero renders instead', async ({ page }) => {
    await page.goto('/?c=some-thread-id-that-cannot-exist', { waitUntil: 'domcontentloaded' })
    // The docked/in-thread layout only renders once a thread with turns loads;
    // containment means loadThread() always resolves null, so the hero (with
    // the prompt starters) is what's on screen instead.
    await expect(page.getByText('THE BEST PRICES IN US REAL ESTATE', { exact: false })).toBeVisible()
  })

  test('POST /api/deed/identity returns an explicit unavailable response, never a token', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const res = await apiJson(page, '/api/deed/identity', {
      method: 'POST',
      body: JSON.stringify({ email: 'visitor@example.com' }),
    })
    expect(res.status).toBe(503)
    expect((res.body as { token?: string }).token).toBeUndefined()
  })

  test('POST /api/deed/upload returns unavailable even with a well-formed-looking legacy token', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const res = await apiJson(page, '/api/deed/upload', {
      method: 'POST',
      headers: { 'x-chat-token': 'not-a-real-but-well-formed.token' },
      body: JSON.stringify({ filename: 'a.txt', data_base64: 'aGk=' }),
    })
    expect(res.status).toBe(503)
  })

  test('GET and POST /api/deed/projects return unavailable, never an empty-but-200 list', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const getRes = await apiJson(page, '/api/deed/projects', { headers: { 'x-chat-token': 'legacy' } })
    expect(getRes.status).toBe(503)

    const postRes = await apiJson(page, '/api/deed/projects', {
      method: 'POST',
      headers: { 'x-chat-token': 'legacy' },
      body: JSON.stringify({ name: 'Should not be created' }),
    })
    expect(postRes.status).toBe(503)
  })

  test('narrow mobile sidebar at /projects has no Recent group and no Chats history entry point', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/projects', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Recent', { exact: true })).toHaveCount(0)
  })
})
