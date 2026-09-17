import type { Metadata } from 'next'

import DeedChat from '@/components/deed-chat/DeedChat'

/**
 * /chat — Deed's conversation on the application shell (PARITY CP-2).
 *
 * Until 2026-09-17 this path was served by the Cloudflare Worker's own
 * vanilla-JS shell (src/worker.js buildChatPage): its own sidebar, robot
 * mascot, flag-emoji language row, a stacked "Talk to Deed" bar. The Worker
 * now proxies /chat (exact) to this app; /chat/api* and /chat/lead stay on the
 * Worker, reached through the same-origin proxies under app/api/deed.
 *
 * force-dynamic for the same reason as '/': middleware mints a per-request
 * CSP nonce and prerendered HTML can never carry one (see app/page.tsx).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Deed — ask about any Florida auction | BidDeed.AI',
  description:
    "Chat with Deed, the BidDeed.AI agent: what's coming to auction, what to bid and what survives the sale — all 67 Florida counties.",
  alternates: { canonical: 'https://biddeed.ai/chat' },
}

export default function ChatPage() {
  // The page reads ?c= / ?new= / ?deed= with useSearchParams; force-dynamic
  // means it needs no Suspense boundary for that — same contract as '/'.
  return <DeedChat />
}
