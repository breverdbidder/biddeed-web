import { test, expect, type Page } from '@playwright/test'
import { apiJson } from './helpers/clerk'

const userA = {
  email: process.env.E2E_USER_A_EMAIL,
  password: process.env.E2E_USER_A_PASSWORD,
}
const userB = {
  email: process.env.E2E_USER_B_EMAIL,
  password: process.env.E2E_USER_B_PASSWORD,
}

function requireCredentials() {
  for (const [name, value] of Object.entries({
    E2E_USER_A_EMAIL: userA.email,
    E2E_USER_A_PASSWORD: userA.password,
    E2E_USER_B_EMAIL: userB.email,
    E2E_USER_B_PASSWORD: userB.password,
  })) {
    if (!value) throw new Error(`${name} is required for the two-user RLS suite`)
  }
}

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


test.describe('Clerk authenticated RLS isolation', () => {
  test('Account B cannot read or mutate Account A saved searches and watchlist rows', async ({ browser }) => {
    test.skip(!process.env.E2E_USER_A_EMAIL || !process.env.E2E_USER_A_PASSWORD || !process.env.E2E_USER_B_EMAIL || !process.env.E2E_USER_B_PASSWORD, 'Dedicated Clerk E2E credentials are not configured')
    requireCredentials()

    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    await signIn(pageA, userA.email!, userA.password!)

    const searchName = `RLS E2E ${Date.now()}`
    const createSearch = await apiJson(pageA, '/api/saved-searches', {
      method: 'POST',
      headers: { 'idempotency-key': `rls-a-${Date.now()}` },
      body: JSON.stringify({ name: searchName, query: { county: 'brevard', status: 'upcoming' } }),
    })
    expect(createSearch.status).toBe(201)
    const searchId = (createSearch.body as { search?: { id?: string } }).search?.id
    expect(searchId).toMatch(/^[0-9a-f-]{36}$/i)

    const createWatch = await apiJson(pageA, '/api/watchlist', {
      method: 'POST',
      headers: { 'idempotency-key': `rls-watch-a-${Date.now()}` },
      body: JSON.stringify({ property_ref: `rls-e2e-${Date.now()}`, label: 'RLS E2E property', case_number: 'RLS-E2E', county: 'brevard' }),
    })
    expect(createWatch.status).toBe(201)
    const watchId = (createWatch.body as { item?: { id?: string } }).item?.id
    expect(watchId).toMatch(/^[0-9a-f-]{36}$/i)

    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    await signIn(pageB, userB.email!, userB.password!)

    const listSearchesB = await apiJson(pageB, '/api/saved-searches')
    expect(listSearchesB.status).toBe(200)
    expect(JSON.stringify(listSearchesB.body)).not.toContain(searchId)
    expect(JSON.stringify(listSearchesB.body)).not.toContain(searchName)

    const crossPatchSearch = await apiJson(pageB, `/api/saved-searches/${searchId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: `${searchName} mutated` }),
    })
    expect(crossPatchSearch.status).toBe(404)

    const listWatchB = await apiJson(pageB, '/api/watchlist')
    expect(listWatchB.status).toBe(200)
    expect(JSON.stringify(listWatchB.body)).not.toContain(watchId)

    const crossDeleteWatch = await apiJson(pageB, `/api/watchlist/${watchId}`, { method: 'DELETE' })
    expect(crossDeleteWatch.status).toBe(404)

    const ownerSearch = await apiJson(pageA, `/api/saved-searches/${searchId}`, { method: 'DELETE' })
    expect(ownerSearch.status).toBe(200)
    const ownerWatch = await apiJson(pageA, `/api/watchlist/${watchId}`, { method: 'DELETE' })
    expect(ownerWatch.status).toBe(200)

    await contextB.close()
    await contextA.close()
  })
})
