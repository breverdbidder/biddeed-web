'use client'

import { useEffect } from 'react'

type Navigate = (href: string, options?: unknown) => void
type RouterInstance = { push: Navigate; replace: Navigate; __bdLeanGuard?: boolean }

const leavesHome = (url: URL) => url.origin === window.location.origin && url.pathname !== '/'

/**
 * Wrap Next's shared router instance so push/replace calls that leave '/'
 * become full page loads. Must run before any component calls useRouter():
 * Next hands every caller a memoised COPY of push/replace taken at render
 * time (next/dist/client/components/navigation.js), so patching a copy - or
 * patching in an effect, after the shell has rendered - changes nothing.
 * `window.next.router` is that shared instance, assigned when Next's router
 * module loads, before hydration starts.
 */
function guardRouter() {
  const router = (window as unknown as { next?: { router?: RouterInstance } }).next?.router
  if (!router || router.__bdLeanGuard) return
  const push = router.push
  const replace = router.replace
  router.push = (href, options) => {
    const url = new URL(href, window.location.href)
    if (leavesHome(url)) window.location.assign(url.href)
    else push(href, options)
  }
  router.replace = (href, options) => {
    const url = new URL(href, window.location.href)
    if (leavesHome(url)) window.location.replace(url.href)
    else replace(href, options)
  }
  router.__bdLeanGuard = true
}

/**
 * Mounted only on the lean home (the signed-out landing page rendered without
 * Clerk - lib/perf/lean-home.ts), as the first child of <body> so it renders
 * before the shell. The root layout is not re-rendered on a client-side
 * navigation, so a soft transition from here would carry the Clerk-less
 * layout onto routes that need ClerkProvider (/sign-in renders <SignIn>).
 * Every navigation that leaves '/' is therefore a full page load, which
 * renders the destination with the normal layout. Staying on '/' (?c=<thread>
 * updates) is untouched. The whole document stays lean for its lifetime, so
 * nothing is ever un-patched.
 *
 * - router.push / router.replace from code (the floating Deed button, the
 *   command palette): the shared router instance is wrapped during this
 *   component's first render (guardRouter).
 * - Link clicks: a capture-phase listener marks the click defaultPrevented,
 *   which next/link honours (it skips its client transition), then loads the
 *   URL. Every other click handler - analytics, menus - still runs.
 */
export default function LeanNavGuard() {
  if (typeof window !== 'undefined') guardRouter()

  useEffect(() => {
    guardRouter()
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (!leavesHome(url)) return
      e.preventDefault()
      window.setTimeout(() => window.location.assign(url.href), 0)
    }
    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [])

  return null
}
