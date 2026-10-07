'use client'

import { useEffect, useState } from 'react'

/**
 * Deferred-work helpers (PageSpeed pass, 2026-10-07).
 *
 * Measured on the live apex with Google PageSpeed Insights: Performance 64 on
 * mobile and 64 on desktop. Most of the cost was JavaScript for things nobody
 * sees on first view - the side Deed panel, the command palette, the lead
 * popup - parsed and executed in the same window as the hero's first paint.
 * Code that is not on screen yet waits for the window `load` event plus a
 * browser idle slot, so it never competes with first paint or hydration.
 */

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

/**
 * Run `cb` once the page has finished loading and the main thread is idle.
 * `timeout` caps the wait for the idle slot (not for `load`). Returns a
 * cancel function for effect cleanup.
 */
export function onIdle(cb: () => void, timeout = 2000): () => void {
  if (typeof window === 'undefined') return () => {}
  const w = window as IdleWindow
  let idleId: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancelled = false

  const schedule = () => {
    if (cancelled) return
    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(() => {
        if (!cancelled) cb()
      }, { timeout })
    } else {
      // Safari has no requestIdleCallback: a short timer after load is the
      // closest equivalent and keeps the work out of the first-paint window.
      timer = setTimeout(() => {
        if (!cancelled) cb()
      }, 200)
    }
  }

  if (document.readyState === 'complete') schedule()
  else window.addEventListener('load', schedule, { once: true })

  return () => {
    cancelled = true
    window.removeEventListener('load', schedule)
    if (idleId !== undefined && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleId)
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** True once the page has loaded and the browser had an idle slot. */
export function useIdleMount(timeout = 2000): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => onIdle(() => setReady(true), timeout), [timeout])
  return ready
}
