import { test, expect, type Browser, type Page } from '@playwright/test'

/**
 * PARITY CP-3 — verified identity for Deed chat (gate D10). The three
 * negatives the meta prompt names, against E2E_BASE_URL:
 *
 *   1. anon → 401 on every persistence route (no session, no rows, no writes)
 *   2. unverified email → cannot read: the legacy X-Chat-Token header (an
 *      email the Worker once took on the visitor's word) buys nothing — 401
 *   3. other-user token → 0 rows: account B never sees, opens or deletes
 *      account A's thread (404, not 403 — existence is not confirmed)
 *
 * 1 and 2 need no credentials and run on every deploy. 3 needs the same two
 * Clerk E2E accounts as rls-isolation.spec.ts (E2E_USER_A/B_*) and skips —
 * loudly, in the report — without them.
 *
 * A 503 from the threads routes means the CP-3 migration is not applied on
 * that environment yet; case 3 reports that as a skip with the reason, since
 * the isolation it proves needs the table to exist.
 */

const A = { email: process.env.E2E_USER_A_EMAIL, password: process.env.E2E_USER_A_PASSWORD }
const B = { email: process.env.E2E_USER_B_EMAIL, password: process.env.E2E_USER_B_PASSWORD }
const haveCreds = Boolean(A.email && A.password && B.email && B.password)

async function apiJson(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(
    async ({ path, init }) => {
      const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } })
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

async function signIn(page: Page, email: string, _password: string) {
  // The UI password flow dead-ends on Clerk Client Trust (new-device email
  // verification) for fresh CI identities - observed 2026-09-17 against
  // https://biddeed.ai (sign-in stalls at /sign-in/client-trust). Clerk's
  // supported production-safe route is a server-side sign-in token, which
  // bypasses verification steps without weakening instance security.
  // Dynamic import: @clerk/testing is installed CI-only (see playwright-rls.yml),
  // and credential-free tests in this file must run without it.
  const { clerk } = await import('@clerk/testing/playwright')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await clerk.signIn({ page, emailAddress: email })
  // The session now lives in this browser context; a protected page must not
  // bounce back to /sign-in.
  await page.goto('/radar', { waitUntil: 'domcontentloaded' })
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 15_000 })
}

const THREAD = (id: string) => ({
  id,
  title: `CP-3 isolation ${id}`,
  turns: [
    { id: 'u1', role: 'user', content: `Private question ${id}`, createdAt: Date.now() },
    { id: 'a1', role: 'assistant', content: 'Private answer.', createdAt: Date.now() + 1 },
  ],
})

test.describe('Deed chat — verified identity (PARITY CP-3)', () => {
  test('anon: every persistence route answers 401 and stores nothing', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    expect((await apiJson(page, '/api/deed/threads')).status).toBe(401)
    expect((await apiJson(page, '/api/deed/threads?q=brevard')).status).toBe(401)
    expect((await apiJson(page, '/api/deed/threads', { method: 'PUT', body: JSON.stringify(THREAD('anon00000001')) })).status).toBe(401)
    expect((await apiJson(page, '/api/deed/threads/anon00000001')).status).toBe(401)
    expect((await apiJson(page, '/api/deed/threads/anon00000001', { method: 'DELETE' })).status).toBe(401)
    expect(
      (await apiJson(page, '/api/deed/upload', { method: 'POST', body: JSON.stringify({ filename: 'a.txt', mime_type: 'text/plain', data_base64: 'aGk=' }) })).status
    ).toBe(401)
    // Citing an upload id in chat is a verified-owner read too.
    const cite = await apiJson(page, '/api/deed', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'What is in the file?' }], upload_id: '00000000-0000-4000-8000-000000000000' }),
    })
    expect(cite.status).toBe(401)
  })

  test('unverified email: the legacy X-Chat-Token header is not an identity — 401 everywhere', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    const legacy = { 'x-chat-token': 'someone@example.com.legacy.token' }
    expect((await apiJson(page, '/api/deed/threads', { headers: legacy })).status).toBe(401)
    expect((await apiJson(page, '/api/deed/threads', { method: 'PUT', headers: legacy, body: JSON.stringify(THREAD('legacy0000001')) })).status).toBe(401)
    expect((await apiJson(page, '/api/deed/threads/legacy0000001', { headers: legacy })).status).toBe(401)
    expect(
      (await apiJson(page, '/api/deed/upload', { method: 'POST', headers: legacy, body: JSON.stringify({ filename: 'a.txt', mime_type: 'text/plain', data_base64: 'aGk=' }) }))
        .status
    ).toBe(401)
    // And the identity issuer is gone, not merely disabled.
    expect((await apiJson(page, '/api/deed/identity', { method: 'POST', body: JSON.stringify({ email: 'someone@example.com' }) })).status).toBe(404)
  })

  test('other user: account B sees 0 rows of account A, cannot open or delete them', async ({ browser }) => {
    test.skip(!haveCreds, 'Dedicated Clerk E2E credentials (E2E_USER_A/B_EMAIL, _PASSWORD) are not configured')
    const id = `cp3${Date.now().toString(36)}`

    const ctxA = await (browser as Browser).newContext()
    const pageA = await ctxA.newPage()
    await signIn(pageA, A.email!, A.password!)
    await pageA.goto('/chat', { waitUntil: 'domcontentloaded' })
    const put = await apiJson(pageA, '/api/deed/threads', { method: 'PUT', body: JSON.stringify(THREAD(id)) })
    test.skip(put.status === 503, 'CP-3 migration not applied on this environment yet (threads route answered 503)')
    expect(put.status).toBe(200)

    const listA = await apiJson(pageA, '/api/deed/threads')
    expect(listA.status).toBe(200)
    expect(JSON.stringify(listA.body)).toContain(id)
    const searchA = await apiJson(pageA, `/api/deed/threads?q=${encodeURIComponent('Private question')}`)
    expect(JSON.stringify(searchA.body)).toContain(id)

    const ctxB = await (browser as Browser).newContext()
    const pageB = await ctxB.newPage()
    await signIn(pageB, B.email!, B.password!)
    await pageB.goto('/chat', { waitUntil: 'domcontentloaded' })

    const listB = await apiJson(pageB, '/api/deed/threads')
    expect(listB.status).toBe(200)
    expect(JSON.stringify(listB.body)).not.toContain(id)
    const searchB = await apiJson(pageB, `/api/deed/threads?q=${encodeURIComponent('Private question')}`)
    expect(JSON.stringify(searchB.body)).not.toContain(id)
    expect((await apiJson(pageB, `/api/deed/threads/${id}`)).status).toBe(404)
    expect((await apiJson(pageB, `/api/deed/threads/${id}`, { method: 'DELETE' })).status).toBe(404)
    // B cannot take the id over by upserting it either.
    expect((await apiJson(pageB, '/api/deed/threads', { method: 'PUT', body: JSON.stringify(THREAD(id)) })).status).toBe(404)

    // A still owns it, and A can remove it.
    expect((await apiJson(pageA, `/api/deed/threads/${id}`)).status).toBe(200)
    expect((await apiJson(pageA, `/api/deed/threads/${id}`, { method: 'DELETE' })).status).toBe(200)

    await ctxB.close()
    await ctxA.close()
  })
})
