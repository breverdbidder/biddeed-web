/**
 * Create a BidDeed.AI account (or sign in to the existing one) from an email
 * the visitor already typed, with a 6-digit email code - the account step of
 * the free-report popup (Ariel, 28 Sep 2026: the popup should create a real
 * account in the same step, not stop at a lead).
 *
 * Measured 28 Sep: an outside visitor entered his email in the popup at
 * 1:33 PM ET, opened the free report and believed he had registered; Clerk
 * showed no new account. The popup captured a lead only.
 *
 * Clerk's rules on this instance (read from /v1/environment 28 Sep): email
 * verified by email_code, a password of 8+ characters required at sign-up,
 * sign-in first factor email_code, bot protection (smart Turnstile) on sign-up.
 * An email that already has an account signs in with a code instead.
 *
 * Works on Clerk's classic resource API (clerk.client.signUp / signIn), passed
 * in as a narrow interface. No imports, so scripts/validate-popup-account.mts
 * runs it under plain node with fakes.
 */

type ClerkErr = { code?: string; message?: string; longMessage?: string; long_message?: string }

export type SignUpLike = {
  status: string | null
  createdSessionId: string | null
  missingFields?: string[]
  create: (p: { emailAddress: string; password: string }) => Promise<SignUpLike>
  prepareEmailAddressVerification: (p: { strategy: 'email_code' }) => Promise<SignUpLike>
  attemptEmailAddressVerification: (p: { code: string }) => Promise<SignUpLike>
}

export type SignInLike = {
  status: string | null
  createdSessionId: string | null
  supportedFirstFactors: Array<{ strategy: string; emailAddressId?: string }> | null
  create: (p: { identifier: string }) => Promise<SignInLike>
  prepareFirstFactor: (p: { strategy: 'email_code'; emailAddressId: string }) => Promise<SignInLike>
  attemptFirstFactor: (p: { strategy: 'email_code'; code: string }) => Promise<SignInLike>
}

export type ClientLike = { signUp: SignUpLike; signIn: SignInLike }

export type Pending =
  | { mode: 'sign_up'; resource: SignUpLike; emailAddressId?: undefined }
  | { mode: 'sign_in'; resource: SignInLike; emailAddressId: string }

export type StartResult = { ok: true; pending: Pending } | { ok: false; message: string; fallback?: 'sign-up' | 'sign-in' }
export type FinishResult = { ok: true; sessionId: string } | { ok: false; message: string; fallback?: 'sign-up' | 'sign-in' }

export const MIN_PASSWORD = 8

function firstError(e: unknown): ClerkErr {
  const errs = (e as { errors?: ClerkErr[] } | null)?.errors
  return Array.isArray(errs) && errs.length ? errs[0] : { message: e instanceof Error ? e.message : '' }
}

/** Plain-language message for a Clerk error, in the visitor's terms. */
export function explain(e: unknown): { message: string; fallback?: 'sign-up' | 'sign-in' } {
  const err = firstError(e)
  const code = err.code || ''
  const long = err.longMessage || err.long_message || err.message || ''
  if (code === 'form_code_incorrect') return { message: "That code isn't right. Check the latest email from BidDeed.AI and try again." }
  if (code === 'verification_expired') return { message: 'That code expired. Tap "Send a new code".' }
  if (code === 'verification_failed' || code === 'too_many_requests') return { message: 'Too many tries. Wait a minute, then tap "Send a new code".' }
  if (code.startsWith('captcha')) return { message: "We couldn't confirm the request came from a person. Try again, or use the full sign-up page.", fallback: 'sign-up' }
  if (code.startsWith('form_password')) return { message: long || `Choose a password of at least ${MIN_PASSWORD} characters.` }
  if (code === 'form_param_format_invalid' || code === 'form_identifier_invalid') return { message: 'That email address looks incomplete. Check it and try again.' }
  return { message: long || 'Something went wrong on our side. Try again, or use the full sign-up page.', fallback: 'sign-up' }
}

/**
 * Starts the account: creates the sign-up and emails a code; an email that
 * already has an account gets a sign-in code instead (no password needed).
 */
export async function startAccount(client: ClientLike, email: string, password: string): Promise<StartResult> {
  const address = email.trim()
  if (password.length < MIN_PASSWORD) return { ok: false, message: `Choose a password of at least ${MIN_PASSWORD} characters.` }
  try {
    const su = await client.signUp.create({ emailAddress: address, password })
    await su.prepareEmailAddressVerification({ strategy: 'email_code' })
    return { ok: true, pending: { mode: 'sign_up', resource: su } }
  } catch (e) {
    if (firstError(e).code !== 'form_identifier_exists') return { ok: false, ...explain(e) }
  }
  // The email already has an account: sign in with a code.
  try {
    const si = await client.signIn.create({ identifier: address })
    const factor = (si.supportedFirstFactors || []).find((f) => f.strategy === 'email_code' && f.emailAddressId)
    if (!factor || !factor.emailAddressId) {
      return { ok: false, message: 'This email already has an account. Sign in to it on the sign-in page.', fallback: 'sign-in' }
    }
    await si.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId })
    return { ok: true, pending: { mode: 'sign_in', resource: si, emailAddressId: factor.emailAddressId } }
  } catch (e) {
    const x = explain(e)
    return { ok: false, message: x.message, fallback: 'sign-in' }
  }
}

/** Sends a fresh code for the pending step. */
export async function resendCode(pending: Pending): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (pending.mode === 'sign_up') await pending.resource.prepareEmailAddressVerification({ strategy: 'email_code' })
    else await pending.resource.prepareFirstFactor({ strategy: 'email_code', emailAddressId: pending.emailAddressId })
    return { ok: true }
  } catch (e) {
    return { ok: false, message: explain(e).message }
  }
}

/** Checks the code; on success returns the session to activate. */
export async function finishAccount(pending: Pending, code: string): Promise<FinishResult> {
  const digits = code.replace(/\D/g, '')
  if (digits.length !== 6) return { ok: false, message: 'Enter the 6-digit code from the email.' }
  try {
    if (pending.mode === 'sign_up') {
      const r = await pending.resource.attemptEmailAddressVerification({ code: digits })
      if (r.status === 'complete' && r.createdSessionId) return { ok: true, sessionId: r.createdSessionId }
      return { ok: false, message: 'Your email is verified. Finish your account on the sign-up page.', fallback: 'sign-up' }
    }
    const r = await pending.resource.attemptFirstFactor({ strategy: 'email_code', code: digits })
    if (r.status === 'complete' && r.createdSessionId) return { ok: true, sessionId: r.createdSessionId }
    return { ok: false, message: 'One more step is needed to sign in. Finish on the sign-in page.', fallback: 'sign-in' }
  } catch (e) {
    const x = explain(e)
    return { ok: false, message: x.message, fallback: x.fallback && (pending.mode === 'sign_in' ? 'sign-in' : 'sign-up') }
  }
}
