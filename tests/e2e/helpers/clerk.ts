import { expect, type Page } from '@playwright/test'

/**
 * Shared Clerk sign-in for the E2E suites — the server-side sign-in-token
 * route proven against https://biddeed.ai on 2026-09-17 (see
 * chat-identity.spec.ts for the history). Needs CLERK_SECRET_KEY and
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in the environment.
 */
export const A = { email: process.env.E2E_USER_A_EMAIL, password: process.env.E2E_USER_A_PASSWORD }
export const B = { email: process.env.E2E_USER_B_EMAIL, password: process.env.E2E_USER_B_PASSWORD }
export const haveCreds = Boolean(A.email && A.password && B.email && B.password)

export async function apiJson(page: Page, path: string, init: RequestInit = {}) {
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
      const headers: Record<string, string> = {}
      response.headers.forEach((v, k) => {
        headers[k] = v
      })
      return { status: response.status, body, headers }
    },
    { path, init }
  )
}

export async function signIn(page: Page, email: string, _password: string) {
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
