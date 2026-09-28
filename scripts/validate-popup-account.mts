// The free-report popup creates a real account from the email it captured
// (Ariel, 28 Sep 2026). Before, it stopped at the lead: an outside visitor gave
// his email at 1:33 PM ET, believed he had registered, and had no account.
// Runs lib/auth/email-code-account.ts against a fake Clerk client with the
// instance's real rules (email_code, password >= 8, existing email -> sign-in).
// Run: node --experimental-strip-types scripts/validate-popup-account.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MIN_PASSWORD,
  explain,
  finishAccount,
  resendCode,
  startAccount,
  type ClientLike,
  type SignInLike,
  type SignUpLike,
} from '../lib/auth/email-code-account.ts'

const clerkError = (code: string, longMessage = '') => Object.assign(new Error(code), { errors: [{ code, longMessage }] })

/** A Clerk stand-in: `existing` emails have accounts; the code is 424242. */
function fakeClient(opts: { existing?: string[]; signInFactors?: SignInLike['supportedFirstFactors']; signInStatus?: string; pwned?: boolean } = {}) {
  const calls: string[] = []
  const CODE = '424242'
  const signUp: SignUpLike = {
    status: null,
    createdSessionId: null,
    async create({ emailAddress, password }) {
      calls.push(`signUp.create ${emailAddress}`)
      if ((opts.existing || []).includes(emailAddress)) throw clerkError('form_identifier_exists')
      if (opts.pwned) throw clerkError('form_password_pwned', 'Password has been found in an online data breach.')
      assert.ok(password.length >= MIN_PASSWORD)
      return signUp
    },
    async prepareEmailAddressVerification({ strategy }) {
      calls.push(`signUp.prepare ${strategy}`)
      return signUp
    },
    async attemptEmailAddressVerification({ code }) {
      calls.push(`signUp.attempt ${code}`)
      if (code !== CODE) throw clerkError('form_code_incorrect')
      signUp.status = 'complete'
      signUp.createdSessionId = 'sess_new'
      return signUp
    },
  }
  const signIn: SignInLike = {
    status: null,
    createdSessionId: null,
    supportedFirstFactors: null,
    async create({ identifier }) {
      calls.push(`signIn.create ${identifier}`)
      signIn.supportedFirstFactors = opts.signInFactors ?? [{ strategy: 'email_code', emailAddressId: 'idn_1' }]
      return signIn
    },
    async prepareFirstFactor({ strategy, emailAddressId }) {
      calls.push(`signIn.prepare ${strategy} ${emailAddressId}`)
      return signIn
    },
    async attemptFirstFactor({ code }) {
      calls.push(`signIn.attempt ${code}`)
      if (code !== CODE) throw clerkError('form_code_incorrect')
      signIn.status = opts.signInStatus ?? 'complete'
      signIn.createdSessionId = signIn.status === 'complete' ? 'sess_existing' : null
      return signIn
    },
  }
  return { client: { signUp, signIn } as ClientLike, calls }
}

let n = 0
const t = async (name: string, fn: () => Promise<void> | void) => {
  await fn()
  n++
  console.log(`ok ${n} ${name}`)
}

await t('a new email becomes an account: code emailed, right code gives a session', async () => {
  const { client, calls } = fakeClient()
  const s = await startAccount(client, '  new@example.com ', 'correct-horse-9')
  assert.ok(s.ok)
  if (!s.ok) return
  assert.equal(s.pending.mode, 'sign_up')
  assert.deepEqual(calls, ['signUp.create new@example.com', 'signUp.prepare email_code'])
  const f = await finishAccount(s.pending, '424 242')
  assert.deepEqual(f, { ok: true, sessionId: 'sess_new' })
})

await t('an email that already has an account gets a sign-in code, no password needed', async () => {
  const { client, calls } = fakeClient({ existing: ['member@example.com'] })
  const s = await startAccount(client, 'member@example.com', 'anything-long')
  assert.ok(s.ok)
  if (!s.ok) return
  assert.equal(s.pending.mode, 'sign_in')
  assert.deepEqual(calls.slice(1), ['signIn.create member@example.com', 'signIn.prepare email_code idn_1'])
  assert.deepEqual(await finishAccount(s.pending, '424242'), { ok: true, sessionId: 'sess_existing' })
})

await t('a wrong code says so and keeps the step open; a new code can be sent', async () => {
  const { client, calls } = fakeClient()
  const s = await startAccount(client, 'new@example.com', 'correct-horse-9')
  if (!s.ok) throw new Error('start failed')
  const f = await finishAccount(s.pending, '111111')
  assert.equal(f.ok, false)
  if (!f.ok) assert.match(f.message, /isn't right/)
  assert.deepEqual(await resendCode(s.pending), { ok: true })
  assert.equal(calls.filter((c) => c === 'signUp.prepare email_code').length, 2)
})

await t('a short or breached password is refused in plain words, before or by Clerk', async () => {
  const short = await startAccount(fakeClient().client, 'new@example.com', 'short')
  assert.equal(short.ok, false)
  if (!short.ok) assert.match(short.message, /at least 8 characters/)
  const pwned = await startAccount(fakeClient({ pwned: true }).client, 'new@example.com', 'password123')
  assert.equal(pwned.ok, false)
  if (!pwned.ok) assert.match(pwned.message, /data breach/)
})

await t('a sign-in that needs another step hands off to the sign-in page', async () => {
  const { client } = fakeClient({ existing: ['member@example.com'], signInStatus: 'needs_client_trust' })
  const s = await startAccount(client, 'member@example.com', 'anything-long')
  if (!s.ok) throw new Error('start failed')
  const f = await finishAccount(s.pending, '424242')
  assert.equal(f.ok, false)
  if (!f.ok) assert.equal(f.fallback, 'sign-in')
  const noCode = await startAccount(fakeClient({ existing: ['m@example.com'], signInFactors: [{ strategy: 'oauth_google' }] }).client, 'm@example.com', 'anything-long')
  assert.equal(noCode.ok, false)
  if (!noCode.ok) assert.equal(noCode.fallback, 'sign-in')
})

await t('bot-protection and unknown errors point to the full sign-up page', () => {
  assert.equal(explain(clerkError('captcha_invalid')).fallback, 'sign-up')
  assert.equal(explain(new Error('network')).fallback, 'sign-up')
  assert.equal(explain(clerkError('form_code_incorrect')).fallback, undefined)
})

await t('the popup renders the account step only inside Clerk, after the lead is captured', () => {
  const popup = readFileSync(new URL('../components/lead/FreeReportPopup.tsx', import.meta.url), 'utf8')
  assert.match(popup, /\{accountStep \? \(\s*<PopupAccountStep email=\{email\.trim\(\)\} \/>/)
  assert.match(popup, /accountStep = false/)
  const gate = readFileSync(new URL('../components/lead/FreeReportPopupAuthGate.tsx', import.meta.url), 'utf8')
  assert.match(gate, /<FreeReportPopup signedIn=\{[^}]+\} accountStep \/>/)
  const provider = readFileSync(new URL('../components/ConditionalClerkProvider.tsx', import.meta.url), 'utf8')
  assert.match(provider, /<FreeReportPopup signedIn=\{false\} \/>/, 'the no-Clerk branch keeps the plain link')
})

await t('the step hosts Clerk bot protection and never sends the email or password to analytics', () => {
  const step = readFileSync(new URL('../components/lead/PopupAccountStep.tsx', import.meta.url), 'utf8')
  assert.match(step, /<div id="clerk-captcha" \/>/)
  // String literals such as method: 'email' are fine; a variable holding the address, password or code is not.
  for (const m of step.matchAll(/track\(([^)]*)\)/g)) assert.doesNotMatch(m[1].replace(/'[^']*'/g, "''"), /email|password|code/i, m[1])
  assert.match(step, /showHandoffOverlay\(document, COLORS\)[\s\S]*setActive\(\{ session: r\.sessionId \}\)[\s\S]*window\.location\.assign\(DESTINATION\)/)
})

console.log(`${n} checks passed`)
