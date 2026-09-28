/**
 * The screen a new member sees between "code accepted" and /radar.
 *
 * 28 Sep 2026: a registrant typed his code, the page went blank for tens of
 * seconds (18 s and 48 s in PostHog on 27 and 28 Sep), and he left thinking
 * sign-up was broken. The cause was a failing Server Action (see
 * config/server-action-origins.mjs); the blank page was React's tree dying
 * with it. This overlay is plain DOM on document.body, so it still shows when
 * the React tree is gone, and it says what is happening while the browser
 * loads /radar.
 *
 * No imports, so scripts/validate-auth-handoff.mts runs it under plain node.
 */
export const HANDOFF_OVERLAY_ID = 'bd-auth-handoff'
export const HANDOFF_COPY = {
  title: 'Signing you in…',
  body: 'Taking you to your BidDeed.AI dashboard.',
} as const

/** How often the fallback asks the server whether the session has landed. */
export const HANDOFF_POLL_MS = 1_000
/** After this long without a session the fallback reloads the page instead. */
export const HANDOFF_GIVE_UP_MS = 90_000

export type HandoffColors = { background: string; ink: string; muted: string; brand: string }

type MinimalDocument = Pick<Document, 'createElement' | 'getElementById'> & { body: Pick<HTMLElement, 'appendChild'> }

/** Shows the overlay (once; later calls return the same element). */
export function showHandoffOverlay(doc: MinimalDocument, colors: HandoffColors): HTMLElement {
  const existing = doc.getElementById(HANDOFF_OVERLAY_ID)
  if (existing) return existing

  const root = doc.createElement('div')
  root.id = HANDOFF_OVERLAY_ID
  root.setAttribute('role', 'status')
  root.setAttribute('aria-live', 'polite')
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    backgroundColor: colors.background,
    color: colors.ink,
    fontFamily: 'inherit',
    textAlign: 'center',
  })

  const card = doc.createElement('div')
  Object.assign(card.style, { maxWidth: '360px', width: '100%' })

  const title = doc.createElement('p')
  title.textContent = HANDOFF_COPY.title
  Object.assign(title.style, { margin: '0', fontSize: '20px', fontWeight: '700', color: colors.ink })

  const body = doc.createElement('p')
  body.textContent = HANDOFF_COPY.body
  Object.assign(body.style, { margin: '8px 0 20px', fontSize: '16px', lineHeight: '1.5', color: colors.muted })

  // An indeterminate <progress> animates natively, so the screen visibly moves
  // without a stylesheet (the CSP nonce does not reach DOM built here).
  const bar = doc.createElement('progress')
  bar.setAttribute('aria-hidden', 'true')
  Object.assign(bar.style, { width: '100%', height: '6px', accentColor: colors.brand })

  card.appendChild(title)
  card.appendChild(body)
  card.appendChild(bar)
  root.appendChild(card)
  doc.body.appendChild(root)
  return root
}

export type HandoffStep = 'go' | 'wait' | 'reload'

/**
 * The fallback's decision on each tick: go to /radar as soon as either the
 * browser's Clerk client or the server reports a session; reload (which
 * re-renders a working form for a visitor who is not signed in) once
 * HANDOFF_GIVE_UP_MS has passed; otherwise ask again in HANDOFF_POLL_MS.
 */
export function handoffStep(input: { elapsedMs: number; clientSession: boolean; serverSignedIn: boolean }): HandoffStep {
  if (input.clientSession || input.serverSignedIn) return 'go'
  if (input.elapsedMs >= HANDOFF_GIVE_UP_MS) return 'reload'
  return 'wait'
}
