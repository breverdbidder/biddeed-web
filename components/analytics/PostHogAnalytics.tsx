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
 * Acquisition attribution: window.__bdAttr() keeps the FIRST known source (UTM, ad
 * click id, or external referrer; 90-day window) and the LAST known source in
 * localStorage (bd_ft / bd_lt) and registers them as super-properties, so EVERY event
 * - $pageview, autocapture, signup_completed, lead_captured - carries first_source,
 * first_medium, first_campaign, last_source ... The Worker's marketing pages run the
 * same function on the same origin, so a visitor who lands on /county/x with
 * ?utm_source=linkedin and signs up on /radar is still attributed to linkedin.
 * Own-domain, Stripe and Clerk referrers are ignored. Outbound links are tagged by
 * biddeed.ai/go/<channel> (cli-anything-biddeed docs/gtm/OUTBOUND_LINKS.md).
 *
 * Session recording is left OFF deliberately: it is the expensive part of
 * PostHog's quota and was not requested for the authed app. Autocapture +
 * pageviews are the low-cost, high-value signal the funnel needs.
 *
 * Privacy (issue #181): respect_dnt is ON, and a browser sending Global Privacy
 * Control starts opted out, so neither kind of visitor is captured at all -
 * not pageviews, not autocapture, not the named funnel events. The loader also
 * skips injecting array.js entirely for those visitors. Named events fired
 * before array.js finishes loading wait on window.__bd_ph_q and are flushed
 * right after init (lib/analytics/funnel.ts).
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

  // init (capture_pageview:false) with an explicit once-per-load capture in the loaded callback records the initial load because no first-load $pageview was observed arriving with the SDK's automatic one (exact SDK reason unproven). With capture_pageview false the SDK cannot also emit it, so no dedupe layer is needed. The App Router does
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
      {`(function(){var n=navigator,d=n.doNotTrack||window.doNotTrack||n.msDoNotTrack;if(d==="1"||d==="yes"||n.globalPrivacyControl===true){window.__bd_ph_q=[];return}window.__bdAttr=function(){var o={first_source:"direct"};try{var ls=window.localStorage,q=new URLSearchParams(location.search),H=location.hostname,own=["biddeed.ai","zonewise.ai","winnerdataai.com","stripe.com","clerk.com","accounts.dev"],clean=function(v){return v?String(v).replace(/[^A-Za-z0-9_.: -]/g,"").slice(0,60):""},rd="";try{if(document.referrer){rd=new URL(document.referrer).hostname;if(rd.indexOf("www.")===0)rd=rd.slice(4)}}catch(e){}for(var i=0;i<own.length;i++){if(rd===own[i]||rd.slice(-(own[i].length+1))==="."+own[i])rd=""}var ck=q.get("gclid")?"gclid":q.get("fbclid")?"fbclid":q.get("msclkid")?"msclkid":"",us=clean(q.get("utm_source")),cur=null;if(us||ck||rd){cur={s:us||(ck==="gclid"?"google":ck==="fbclid"?"facebook":ck==="msclkid"?"bing":rd),m:clean(q.get("utm_medium"))||(ck?"paid":"referral"),c:clean(q.get("utm_campaign")),k:clean(q.get("utm_content")),p:location.pathname.slice(0,60),d:Date.now()}}var ft=null,lt=null;try{ft=JSON.parse(ls.getItem("bd_ft")||"null");lt=JSON.parse(ls.getItem("bd_lt")||"null")}catch(e){}if(cur){if(!ft||Date.now()-ft.d>7776000000){ft=cur;try{ls.setItem("bd_ft",JSON.stringify(ft))}catch(e){}}lt=cur;try{ls.setItem("bd_lt",JSON.stringify(lt))}catch(e){}}if(ft){o.first_source=ft.s;o.first_medium=ft.m;if(ft.c)o.first_campaign=ft.c;if(ft.k)o.first_content=ft.k;o.first_landing=ft.p}if(lt){o.last_source=lt.s;o.last_medium=lt.m;if(lt.c)o.last_campaign=lt.c}}catch(e){}return o};var s=document.createElement("script");s.src="${POSTHOG_ASSET_HOST}/static/array.js";s.async=true;s.crossOrigin="anonymous";s.onload=function(){var p=window.posthog;if(p&&p.init){p.init("${POSTHOG_KEY}",{api_host:"${POSTHOG_API_HOST}",capture_pageview:false,autocapture:true,disable_session_recording:true,respect_dnt:true,opt_out_capturing_by_default:n.globalPrivacyControl===true,loaded:function(ph){try{ph.register(window.__bdAttr())}catch(e){}try{if(!window.__bd_pv0){window.__bd_pv0=1;ph.capture("$pageview")}}catch(e){}var q=window.__bd_ph_q||[];window.__bd_ph_q=[];for(var i=0;i<q.length;i++){try{ph.capture(q[i][0],q[i][1],q[i][2])}catch(e){}}}})}};document.head.appendChild(s);})();`}
    </Script>
  )
}

