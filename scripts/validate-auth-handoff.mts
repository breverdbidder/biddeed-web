// Sign-up must not hang after the code is accepted. Before 28 Sep 2026 every
// Server Action on biddeed.ai answered 500 (Next's CSRF check, error E80),
// including the one Clerk awaits before it activates a new session, so new
// members sat on a blank page for 18-48 s (config/server-action-origins.mjs).
// Run: node --experimental-strip-types scripts/validate-auth-handoff.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { SERVER_ACTION_ALLOWED_ORIGINS } from '../config/server-action-origins.mjs'
import {
  HANDOFF_COPY,
  HANDOFF_GIVE_UP_MS,
  HANDOFF_OVERLAY_ID,
  HANDOFF_POLL_MS,
  handoffStep,
  showHandoffOverlay,
} from '../lib/auth/handoff.ts'

const require = createRequire(import.meta.url)
// The matcher Next itself applies to experimental.serverActions.allowedOrigins.
const { isCsrfOriginAllowed } = require('next/dist/server/app-render/csrf-protection.js') as {
  isCsrfOriginAllowed: (originDomain: string, allowedOrigins?: string[]) => boolean
}

let n = 0
const t = (name: string, fn: () => void) => {
  fn()
  n++
  console.log(`ok ${n} ${name}`)
}

t('Next accepts Server Actions posted from the public origins', () => {
  assert.equal(isCsrfOriginAllowed('biddeed.ai', SERVER_ACTION_ALLOWED_ORIGINS), true)
  assert.equal(isCsrfOriginAllowed('www.biddeed.ai', SERVER_ACTION_ALLOWED_ORIGINS), true)
})

t('...and still refuses every other origin', () => {
  for (const other of ['evil.example', 'biddeed.ai.evil.example', 'xbiddeed.ai', 'staging.biddeed.ai', 'null']) {
    assert.equal(isCsrfOriginAllowed(other, SERVER_ACTION_ALLOWED_ORIGINS), false, other)
  }
})

t('next.config.mjs passes the list to experimental.serverActions', () => {
  const src = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8')
  assert.match(src, /import \{ SERVER_ACTION_ALLOWED_ORIGINS \} from '\.\/config\/server-action-origins\.mjs'/)
  assert.match(src, /serverActions:\s*\{\s*allowedOrigins:\s*SERVER_ACTION_ALLOWED_ORIGINS\s*\}/)
})

// A document just rich enough for the overlay builder.
function fakeDocument() {
  type El = { tag: string; id: string; textContent: string; style: Record<string, string>; attrs: Record<string, string>; children: El[]; setAttribute: (k: string, v: string) => void; appendChild: (c: El) => El }
  const make = (tag: string): El => {
    const el: El = {
      tag, id: '', textContent: '', style: {}, attrs: {}, children: [],
      setAttribute(k, v) { el.attrs[k] = v },
      appendChild(c) { el.children.push(c); return c },
    }
    return el
  }
  const body = make('body')
  const all = (el: El): El[] => [el, ...el.children.flatMap(all)]
  return {
    body,
    createElement: make,
    getElementById: (id: string) => all(body).find((e) => e.id === id) ?? null,
  }
}
const COLORS = { background: '#ffffff', ink: '#1a1a1a', muted: '#0A2540', brand: '#005EB8' }

t('the handoff screen says what is happening, covers the page and is announced', () => {
  const doc = fakeDocument()
  const el = showHandoffOverlay(doc as never, COLORS) as unknown as ReturnType<typeof doc.createElement>
  assert.equal(el.id, HANDOFF_OVERLAY_ID)
  assert.equal(el.attrs.role, 'status')
  assert.equal(el.attrs['aria-live'], 'polite')
  assert.equal(el.style.position, 'fixed')
  assert.equal(el.style.inset, '0')
  assert.equal(el.style.backgroundColor, COLORS.background)
  const text = JSON.stringify(el)
  assert.ok(text.includes(HANDOFF_COPY.title) && text.includes(HANDOFF_COPY.body))
  assert.ok(el.children[0].children.some((c) => c.tag === 'progress'), 'moving progress bar')
})

t('showing it twice leaves one overlay', () => {
  const doc = fakeDocument()
  const a = showHandoffOverlay(doc as never, COLORS)
  const b = showHandoffOverlay(doc as never, COLORS)
  assert.equal(a, b)
  assert.equal(doc.body.children.length, 1)
})

t('the fallback leaves as soon as either side reports a session, and checks every second', () => {
  assert.equal(HANDOFF_POLL_MS, 1_000)
  assert.equal(handoffStep({ elapsedMs: 0, clientSession: true, serverSignedIn: false }), 'go')
  assert.equal(handoffStep({ elapsedMs: 0, clientSession: false, serverSignedIn: true }), 'go')
  assert.equal(handoffStep({ elapsedMs: 5_000, clientSession: false, serverSignedIn: false }), 'wait')
  assert.equal(handoffStep({ elapsedMs: HANDOFF_GIVE_UP_MS, clientSession: false, serverSignedIn: false }), 'reload')
  assert.equal(handoffStep({ elapsedMs: HANDOFF_GIVE_UP_MS + 1, clientSession: false, serverSignedIn: true }), 'go')
})

t('SignedInRedirect uses the overlay on both layers', () => {
  const src = readFileSync(new URL('../components/auth/SignedInRedirect.tsx', import.meta.url), 'utf8')
  assert.match(src, /function leaveFor\(to: string\) \{\s*showHandoffOverlay\(document, COLORS\)\s*window\.location\.assign\(to\)/)
  assert.match(src, /if \(isLoaded && isSignedIn\) leaveFor\(to\)/)
  assert.match(src, /done = true\s*showHandoffOverlay\(document, COLORS\)/)
})

console.log(`${n} checks passed`)
