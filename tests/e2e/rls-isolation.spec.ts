import { test, expect, type Page } from '@playwright/test'

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

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' })
  const identifier = page.locator('#identifier-field')
  await expect(identifier).toBeVisible()
  await identifier.fill(email)
  await page.getByRole('button', { name: 'Continue' }).click()

  const passwordField = page.locator('#password-field')
  await expect(passwordField).toBeVisible()
  await passwordField.fill(password)
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page).toHaveURL(/\/(radar|discover|alerts|counties)(\?|$)/, { timeout: 30_000 })
}

async function apiJson(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    })
    const text = await response.text()
    let body: unknown = null
    try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
    return { status: response.status, body }
  }, { path, init })
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
