'use client'

import Script from 'next/script'

// Chatwoot Cloud website widget — additive bottom-right bubble, not a
// replacement for the existing full-page /chat (Deed). No-ops (renders
// nothing) when the website token isn't set, mirroring the same
// no-op-until-provisioned gate the Cloudflare Worker uses for the apex and
// other Worker-rendered routes (see injectChatwootWidget in src/worker.js,
// cli-anything-biddeed). This covers the Next.js-rendered routes the Worker
// does not: '/', and everything else biddeed-web serves.
const CHATWOOT_TOKEN = process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN_BIDDEED
const CHATWOOT_BASE_URL =
  process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || 'https://app.chatwoot.com'

export default function ChatwootWidget({ nonce }: { nonce?: string }) {
  if (!CHATWOOT_TOKEN) return null

  return (
    <>
      {/*
        window.chatwootSettings must exist before sdk.js runs, so it is a
        separate, earlier script tag rather than inlined into the loader
        below. Both carry the CSP nonce: middleware.ts runs script-src with
        'strict-dynamic', which makes host-allowlisting app.chatwoot.com in
        script-src inert on its own — only nonced (or nonce-descended)
        scripts execute. sdk.js itself loads from Chatwoot's own origin and
        is not subject to this app's nonce, but the two inline tags that
        create it and call chatwootSDK.run() are, and must carry it.
      */}
      <Script
        id="chatwoot-settings"
        strategy="afterInteractive"
        nonce={nonce}
      >
        {`window.chatwootSettings={position:"right",type:"standard",launcherTitle:"Ask BidDeed",darkMode:"dark"};`}
      </Script>
      <Script
        id="chatwoot-sdk"
        strategy="afterInteractive"
        nonce={nonce}
      >
        {`(function(d,t){var BASE_URL="${CHATWOOT_BASE_URL}";var g=d.createElement(t),s=d.getElementsByTagName(t)[0];g.src=BASE_URL+"/packs/js/sdk.js";g.defer=true;g.async=true;s.parentNode.insertBefore(g,s);g.onload=function(){window.chatwootSDK.run({websiteToken:"${CHATWOOT_TOKEN}",baseUrl:BASE_URL})}})(document,"script");`}
      </Script>
    </>
  )
}
