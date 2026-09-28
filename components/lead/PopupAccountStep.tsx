'use client'

import { useRef, useState } from 'react'
import { useClerk } from '@clerk/nextjs'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics/funnel'
import { LIGHT as C } from '@/lib/design-tokens'
import { showHandoffOverlay } from '@/lib/auth/handoff'
import {
  MIN_PASSWORD,
  finishAccount,
  resendCode,
  startAccount,
  type ClientLike,
  type Pending,
} from '@/lib/auth/email-code-account'

const DESTINATION = '/radar'
const COLORS = { background: C.background, ink: C.ink, muted: C.navy, brand: C.brand }

type Fallback = 'sign-up' | 'sign-in' | undefined

/**
 * The free-report popup's account step: the email the visitor just gave us
 * becomes a free BidDeed.AI account (password + emailed 6-digit code), or,
 * when that email already has an account, a code signs them in. Rendered only
 * inside ClerkProvider (FreeReportPopupAuthGate). See lib/auth/email-code-account.ts.
 */
export default function PopupAccountStep({ email }: { email: string }) {
  const clerk = useClerk()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [fallback, setFallback] = useState<Fallback>(undefined)
  const [phase, setPhase] = useState<'password' | 'code'>('password')
  const pending = useRef<Pending | null>(null)

  const client = () => (clerk.client as unknown as ClientLike | undefined) ?? null

  async function onStart(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setFallback(undefined)
    const c = client()
    if (!c) {
      setMessage('Sign-up is still loading. Try again in a moment.')
      return
    }
    setBusy(true)
    track('signup_prompt_clicked', { surface: 'free_report_popup', method: 'email' })
    const r = await startAccount(c, email, password)
    setBusy(false)
    if (!r.ok) {
      setMessage(r.message)
      setFallback(r.fallback)
      return
    }
    pending.current = r.pending
    setNotice(
      r.pending.mode === 'sign_in'
        ? `${email} already has a BidDeed.AI account. We emailed a 6-digit code to sign you in.`
        : `We emailed a 6-digit code to ${email}.`
    )
    setPhase('code')
    setTimeout(() => document.getElementById('frp-code')?.focus(), 0)
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!pending.current) return
    setMessage('')
    setFallback(undefined)
    setBusy(true)
    const r = await finishAccount(pending.current, code)
    if (!r.ok) {
      setBusy(false)
      setMessage(r.message)
      setFallback(r.fallback)
      return
    }
    // Same hand-off as the auth pages: say what is happening, then load the
    // workspace as a new document so the server sees the new session.
    showHandoffOverlay(document, COLORS)
    try {
      await clerk.setActive({ session: r.sessionId })
    } catch {
      // The session exists server-side; the document load below resolves it.
    }
    window.location.assign(DESTINATION)
  }

  async function onResend() {
    if (!pending.current) return
    setMessage('')
    setBusy(true)
    const r = await resendCode(pending.current)
    setBusy(false)
    if (r.ok) setNotice(`We emailed a new code to ${email}.`)
    else setMessage(r.message)
  }

  async function onGoogle() {
    const c = clerk.client
    if (!c) return
    track('signup_prompt_clicked', { surface: 'free_report_popup', method: 'oauth' })
    try {
      await c.signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sign-up/sso-callback',
        redirectUrlComplete: DESTINATION,
      })
    } catch {
      setMessage('Google sign-up did not start. Use a password below, or the full sign-up page.')
      setFallback('sign-up')
    }
  }

  const fallbackHref = fallback === 'sign-in' ? '/sign-in' : `/sign-up?redirect_url=${encodeURIComponent(DESTINATION)}`

  return (
    <section aria-labelledby="frp-account-title" className="flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <h3 id="frp-account-title" className="text-base font-bold text-foreground">
          Save it to your free account
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Free members see the assessed value, market value and parcel ID on every auction property.
        </p>
      </div>

      {phase === 'password' ? (
        <>
          <Button type="button" variant="outline" onClick={onGoogle} disabled={busy} className="min-h-12 text-base font-semibold">
            Continue with Google
          </Button>
          <form onSubmit={onStart} className="flex flex-col gap-3" noValidate>
            <p className="text-sm text-foreground">
              Or use <span className="font-semibold">{email}</span> with a password:
            </p>
            <label htmlFor="frp-password" className="sr-only">
              Choose a password
            </label>
            <Input
              id="frp-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              placeholder={`Choose a password (${MIN_PASSWORD}+ characters)`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-12 text-base"
            />
            {/* Clerk bot protection renders here when it needs a visible check. */}
            <div id="clerk-captcha" />
            <Button type="submit" disabled={busy} className="min-h-12 text-base font-semibold">
              {busy ? 'Creating your account…' : 'Create my free account'}
            </Button>
          </form>
        </>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-3" noValidate>
          <p className="text-sm text-foreground" role="status">
            {notice}
          </p>
          <label htmlFor="frp-code" className="text-sm font-semibold text-foreground">
            6-digit code
          </label>
          <Input
            id="frp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="min-h-12 text-center text-lg tracking-[0.4em]"
          />
          <Button type="submit" disabled={busy || code.length !== 6} className="min-h-12 text-base font-semibold">
            {busy ? 'Signing you in…' : 'Verify and sign in'}
          </Button>
          <button
            type="button"
            onClick={onResend}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-60"
          >
            Send a new code
          </button>
        </form>
      )}

      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}{' '}
          {fallback ? (
            <a href={fallbackHref} className="font-semibold underline underline-offset-4">
              {fallback === 'sign-in' ? 'Go to sign-in' : 'Go to the sign-up page'}
            </a>
          ) : null}
        </p>
      ) : null}
    </section>
  )
}
