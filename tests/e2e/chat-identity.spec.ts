import { test, expect, type Browser, type Page } from '@playwright/test'
import { apiJson } from './helpers/clerk'

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


async function signIn(page: Page, email: string, _password: string) {
  // The UI password flow dead-ends on Clerk Client Trust (new-device email
  // verification) for fresh CI identities - observed 2026-09-17 against
  // https://biddeed.ai (sign-in stalls at /sign-in/client-trust). Clerk's
  // supported production-safe route is a server-side sign-in token.
  // clerk.signIn() itself cannot run here: its in-page Clerk.setActive call
  // triggers an app navigation that destroys the helper's pending
  // page.evaluate ("Resulting promise was garbage collected", run 35283186275),
  // and setActive never resolves headless. Redeem the ticket through the FAPI
  // client directly (its response already sets the session cookie) and reload.
  // Proven live against https://biddeed.ai 2026-09-17: both E2E users sign in
  // and the full 18-check two-user isolation proof passes.
  const { setupClerkTestingToken } = await import('@clerk/testing/playwright')
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const fapiHost = Buffer.from(pk.replace(/^pk_(?:test|live)_/, ''), 'base64')
    .toString('utf8')
    .replace(/\$$/, '')
  if (!fapiHost) {
    throw new Error('Cannot derive Clerk Frontend API host from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')
  }
  const secret = process.env.CLERK_SECRET_KEY
  if (!secret) throw new Error('CLERK_SECRET_KEY is required for token sign-in')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await setupClerkTestingToken({ page, options: { frontendApiUrl: fapiHost } })
  await page.waitForFunction(() => (window as any).Clerk && (window as any).Clerk.loaded)
  const users = (await (
    await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
  ).json()) as Array<{ id: string }>
  if (!users[0]) throw new Error(`No Clerk user for ${email}`)
  const minted = (await (
    await fetch('https://api.clerk.com/v1/sign_in_tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: users[0].id, expires_in_seconds: 300 }),
    })
  ).json()) as { token?: string }
  if (!minted.token) throw new Error('sign_in_tokens returned no token')
  const created = await page.evaluate(async (t) => {
    const si = await (window as any).Clerk.client.signIn.create({ strategy: 'ticket', ticket: t })
    return { status: si.status as string, session: (si.createdSessionId ?? null) as string | null }
  }, minted.token)
  if (created.status !== 'complete' || !created.session) {
    throw new Error(`Ticket sign-in not complete: ${JSON.stringify(created)}`)
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  // Tolerate any post-reload navigation while Clerk recognizes the session.
  const deadline = Date.now() + 20_000
  let signedIn = false
  while (Date.now() < deadline) {
    try {
      signedIn = await page.evaluate(() => Boolean((window as any).Clerk?.user))
      if (signedIn) break
    } catch {
      /* execution context destroyed by navigation - retry */
    }
    await page.waitForTimeout(500)
  }
  if (!signedIn) throw new Error(`No session after ticket redemption for ${email}`)
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
