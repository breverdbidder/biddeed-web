'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * PostHog browser analytics for the biddeed-web app.
 *
 * The Cloudflare Worker (public marketing pages) already reports into this
 * PostHog project via the standard snippet, but this Next app — the entire
 * signed-in product (/radar, /alerts, /chat, /discover, /d4d, ...) — shipped
 * with no browser SDK at all. Confirmed 2026-09-19: authed sessions were
 * invisible in PostHog (zero $pageview, zero $autocapture), which is why a live
 * sign-out session could not be replayed. This closes that blind spot using the
 * SAME project key + host the Worker uses, so app and marketing events unify.
 *
 * Loaded exactly like ChatwootWidget loads its SDK: a nonced inline <Script>.
 * script-src runs 'strict-dynamic', so host-allowlisting PostHog in the CSP is
 * inert on its own — only nonced (or nonce-descended) scripts execute. The
 * inline tag carries the nonce; array.js, injected by it, is nonce-descended.
 * Ingestion to us.i.posthog.com is governed by connect-src (NOT relaxed by
 * strict-dynamic); both hosts were added to the app CSP in middleware.ts.
 *
 * Session recording is left OFF deliberately: it is the expensive part of
 * PostHog's quota and was not requested for the authed app. Autocapture +
 * pageviews are the low-cost, high-value signal the funnel needs.
 */

const POSTHOG_KEY = 'phc_zUQGNqDUYXbpJn7RGKt2wwnHfP8GXge2MZsYAJXTs14'
const POSTHOG_API_HOST = 'https://us.i.posthog.com'
const POSTHOG_ASSET_HOST = 'https://us-assets.i.posthog.com'

type PostHogLike = { capture?: (event: string) => void; init?: unknown }
function ph(): PostHogLike | undefined {
  return (globalThis as unknown as { posthog?: PostHogLike }).posthog
}

export default function PostHogAnalytics({ nonce }: { nonce?: string }) {
  const pathname = usePathname()
  const firstRun = useRef(true)

  // init (capture_pageview:true) records the initial load. The App Router does
  // soft client navigations that fire no new document load, so every SUBSEQUENT
  // route change is captured here manually. Skipping the first run avoids
  // double-counting the landing page.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    ph()?.capture?.('$pageview')
  }, [pathname])

  return (
    <Script id="posthog-init" strategy="afterInteractive" nonce={nonce}>
      {`(function(){var s=document.createElement("script");s.src="${POSTHOG_ASSET_HOST}/static/array.js";s.async=true;s.crossOrigin="anonymous";s.onload=function(){if(window.posthog&&window.posthog.init){window.posthog.init("${POSTHOG_KEY}",{api_host:"${POSTHOG_API_HOST}",capture_pageview:true,autocapture:true,disable_session_recording:true})}};document.head.appendChild(s);})();`}
    </Script>
  )
}
