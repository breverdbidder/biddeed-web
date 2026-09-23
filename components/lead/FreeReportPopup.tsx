'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRight, Check, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SAMPLE_REPORT_PATH, track } from '@/lib/analytics/funnel'

/**
 * Free-report lead popup (issue #181 scope add, 2026-09-23): a popup with a
 * strong hook and one immediate action.
 *
 * Email in, free report out: the keyless public sample SIGNAL$ Property Report
 * opens the moment the email is accepted. The email lands in lead_profiles via
 * POST /api/leads/free-report (source popup_free_report).
 *
 * Who sees it: signed-out visitors on the entry pages below, once. Signed-in
 * members never do. Dismissed = quiet for 3 days; captured = never again.
 * When it opens: after a short dwell, 45% scroll, or desktop exit intent,
 * whichever comes first - and never while the visitor is typing in a field
 * (someone filling the $25 checkout is left alone). Append ?frp=1 to force it
 * for QA.
 */

const SHOW_ON = ['/', '/buy-report', '/pricing', '/counties', '/academy', '/auctions', '/preview', '/maps', '/discover']
const DWELL_MS: Record<string, number> = { '/buy-report': 8000 }
const DEFAULT_DWELL_MS = 12000
const DISMISS_QUIET_MS = 3 * 24 * 60 * 60 * 1000
const KEY_DISMISSED = 'bd_frp_dismissed_at'
const KEY_CAPTURED = 'bd_frp_captured'

type Trigger = 'timer' | 'scroll' | 'exit_intent' | 'forced'

function eligiblePath(pathname: string) {
  return SHOW_ON.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

function suppressed(): boolean {
  try {
    if (localStorage.getItem(KEY_CAPTURED)) return true
    const at = Number(localStorage.getItem(KEY_DISMISSED) || 0)
    return Boolean(at && Date.now() - at < DISMISS_QUIET_MS)
  } catch {
    return false
  }
}

function typingInField(): boolean {
  const el = document.activeElement
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'))
}

const WHAT_YOU_GET = [
  'Comparable sales and both value bands',
  'Judgment and encumbrance review',
  'The auction outcome, checked after the sale',
]

export default function FreeReportPopup({ signedIn }: { signedIn: boolean | undefined }) {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [digest, setDigest] = useState(false)
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const shown = useRef(false)

  const show = useCallback(
    (trigger: Trigger) => {
      if (shown.current) return
      shown.current = true
      setOpen(true)
      track('free_report_popup_shown', { surface: 'free_report_popup', trigger: trigger === 'forced' ? 'timer' : trigger })
    },
    []
  )

  useEffect(() => {
    if (signedIn !== false || shown.current) return
    const forced = new URLSearchParams(window.location.search).get('frp') === '1'
    if (forced) {
      show('forced')
      return
    }
    if (!eligiblePath(pathname) || suppressed()) return

    const attempt = (t: Trigger) => {
      if (typingInField()) return false
      show(t)
      return true
    }

    let timer: ReturnType<typeof setTimeout>
    const dwell = DWELL_MS[pathname] ?? DEFAULT_DWELL_MS
    const onTimer = () => {
      // Visitor is mid-form (e.g. the $25 checkout email): try again later.
      if (!attempt('timer')) timer = setTimeout(onTimer, 10000)
    }
    timer = setTimeout(onTimer, dwell)

    const onScroll = () => {
      const h = document.documentElement
      const depth = (h.scrollTop + window.innerHeight) / Math.max(h.scrollHeight, 1)
      if (depth >= 0.45 && window.scrollY > 200) attempt('scroll')
    }
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) attempt('exit_intent')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [signedIn, pathname, show])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next && !done) {
      try {
        localStorage.setItem(KEY_DISMISSED, String(Date.now()))
      } catch {}
      track('free_report_popup_dismissed', { surface: 'free_report_popup' })
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads/free-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), digest_opt_in: digest, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Please enter a valid email.')
        return
      }
      track('lead_captured', { surface: 'free_report_popup', digest_opt_in: digest, stored: Boolean(data.stored) })
      try {
        localStorage.setItem(KEY_CAPTURED, '1')
      } catch {}
      setDone(true)
    } catch {
      setError('Network hiccup. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const signupHref = `/sign-up?redirect_url=${encodeURIComponent(pathname)}`

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
          onOpenAutoFocus={(e) => {
            // Focus the email field, not the close button: one tap to type.
            e.preventDefault()
            document.getElementById('frp-email')?.focus()
          }}
        >
          <div className="bg-primary px-6 pb-5 pt-6 text-primary-foreground">
            <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-90">Free · Instant · No card</p>
            <Dialog.Title className="mt-2 text-2xl font-bold leading-tight">
              {done ? 'Your free report is ready.' : 'Read a real SIGNAL$ Property Report, free.'}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-base leading-6 opacity-95">
              {done
                ? 'All 18 sections on a real Florida auction property. Open it now.'
                : 'All 18 sections on a real Florida auction property. Enter your email and it opens right now.'}
            </Dialog.Description>
          </div>
          <Dialog.Close
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full text-primary-foreground/90 hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
          >
            <X className="size-5" aria-hidden />
          </Dialog.Close>

          <div className="px-6 pb-6 pt-5">
            {done ? (
              <div className="flex flex-col gap-3">
                <a
                  href={SAMPLE_REPORT_PATH}
                  target="_blank"
                  rel="noopener"
                  onClick={() => track('report_viewed', { report_type: 'sample', surface: 'free_report_popup' }, { beacon: true })}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary-hover"
                >
                  Open my free report <ArrowRight className="size-4" aria-hidden />
                </a>
                <a
                  href={signupHref}
                  onClick={() => track('signup_prompt_clicked', { surface: 'free_report_popup' })}
                  className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Create a free account to follow the next auction
                </a>
              </div>
            ) : (
              <>
                <ul className="mb-4 flex flex-col gap-2">
                  {WHAT_YOU_GET.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
                  <label htmlFor="frp-email" className="sr-only">
                    Email address
                  </label>
                  <Input
                    id="frp-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-12 text-base"
                  />
                  {/* Honeypot - hidden from people and screen readers. */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="absolute -left-[9999px] h-px w-px border border-input opacity-0"
                  />
                  <Button type="submit" disabled={submitting} className="min-h-12 text-base font-semibold">
                    {submitting ? 'Unlocking…' : (
                      <>
                        Open my free report <ArrowRight className="size-4" aria-hidden />
                      </>
                    )}
                  </Button>
                  <label className="flex items-start gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={digest}
                      onChange={(e) => setDigest(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 rounded border border-input"
                    />
                    Also send me the daily auction digest (optional)
                  </label>
                  {error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}
                </form>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  No card. We only email you if you tick the box.{' '}
                  <a
                    href={signupHref}
                    onClick={() => track('signup_prompt_clicked', { surface: 'free_report_popup' })}
                    className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Or create a free account
                  </a>
                </p>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
