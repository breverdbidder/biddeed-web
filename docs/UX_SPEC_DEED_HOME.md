# BidDeed.AI — Customer experience spec (chat-first home)

Status: implemented in this PR. Owner: AI Architect. Reference class: Claude.ai, ChatGPT, Manus.

## 1. What was wrong (audit of production `/`, Sep 3 2026)

Measured against the live DOM and local renders at 390 / 1440 px.

| # | Finding | Severity |
|---|---------|----------|
| 1 | Two navigation systems on one screen: the app sidebar (Home, Auctions, Calendar…) **and** a second in-page "funnel nav" (Counties, Blog, Chat, Pioneers, Investor $99, GET A REPORT). A first-time visitor has 15 links above the headline. | High |
| 2 | Three separate entry points to the same agent — sidebar item "Deed", topbar "Deed Voice AI", floating "Talk to Deed" card — and the agent itself is a side drawer, not the product. The comparison class (Claude / ChatGPT / Manus) makes the conversation *the* home surface. | High |
| 3 | Developer language on a customer surface: "Live from /api/auctions/summary → auctions_summary_ssot(). Em-dash means the endpoint has not answered", "Built by the developer, not sold to him", "S5 Report", "Clear to Bid is the $27 product". Customers do not know what S5, Clear to Bid, or an em-dash convention are. | High |
| 4 | Headline "Florida auctions close in minutes. You get one number to be right about." is clever but does not say what the product does. The confirmed one-liner (calendar → max bid → zoning, before you bid) never appears above the fold. | High |
| 5 | Pricing cards contradict the confirmed tier structure (Pro is described as "scoring probabilities + API access"; canon is ZoneWise zoning per property, 10 Shapira calls, 15 skip traces, 3 monitors). Pro Plus is missing. Free tier is missing. | High |
| 6 | Theme is two systems fighting: semantic cream/terracotta tokens on `<html>` plus hard-coded `slate-*` / `#020617` classes, patched with 30 `!important` attribute-selector overrides in `globals.css`. Dark mode has no semantic token set at all, so a toggle produces a half-dark page. | Medium |
| 7 | Nested `<main>` landmarks (`SidebarInset` renders `<main>`, AppShell nests another). | Medium (a11y) |
| 8 | Stats render as `—` on first paint (client fetch only); hero map shows an apology panel when Mapbox is slow. First impression is "the data isn't there". | Medium |
| 9 | Deed's SSE `properties` payload is swallowed; answers are plain text tables, truncated by the upstream Worker at ~1.5k chars mid-row. | Medium (backend + UI) |
| 10 | Mobile: 4,300 px of landing to scroll before any interactive product; CTA buttons 3 abreast wrap awkwardly at 390 px. | Medium |

## 2. Principles (borrowed from the reference class)

1. **The conversation is the home.** One input, centered, with prompt starters. Everything else is supporting evidence below the fold.
2. **Answer with UI, not prose.** When the customer asks about auctions, Deed returns *cards* built from our own `/api/auctions` rows (deterministic, complete, linkable), and the model narrates. The model never has to format a table.
3. **One accent, one voice, one nav.** Terracotta is the only action colour. The sidebar is the only navigation. Copy speaks to an investor, never to a developer.
4. **Calm surface.** Cream canvas, ink text, generous whitespace, serif display type for the headline (editorial, trustworthy), sans for UI.
5. **Honest numbers.** Live counts stay live (SSOT RPC), but the *explanation* of how they are sourced moves to a tooltip.
6. **Mobile is the primary layout.** Composer docks to the bottom of the viewport; chips scroll horizontally; cards stack.

## 3. Information architecture

```
/                       Deed — new conversation (hero composer) → in-place thread (?c=<id>)
  ├─ Prompt starters    Find · Price · Learn
  ├─ Trust strip        live counts, 67 counties, published-before-the-sale proof
  ├─ How it works       Ask → Deed reads calendar + parcel → Max bid + SIGNAL$ report
  ├─ Pricing            Free · Investor $99 · Pro $199 · Pro Plus $299 · SIGNAL$ report $25
  └─ Footer             legal, counties, blog
Sidebar                 New chat · Recent (local history) · Workspace (Auctions, Calendar, Discover, Alerts, Counties, Reports) · Account
/radar*                 unchanged workspace; Deed side panel remains available there
```

New app routes are **not** added: the Cloudflare Worker only proxies `/`, `/_next/*`, `/api/*`, `/radar*`, `/success`, `/order*`, `/discover`, `/alerts`, `/sign-*` to this app. The thread therefore lives at `/?c=<threadId>`.

## 4. Conversation behaviour

- Send from the hero → the page becomes the thread (no navigation, URL gains `?c=`). Composer moves to the bottom and stays docked.
- Threads persist in `localStorage` (`biddeed.deed.threads.v1`, max 30). "Recent" in the sidebar lists them; "New chat" clears.
- Intent parser (`lib/deed/intent.ts`) reads county, sale type (foreclosure / tax deed), time window (today / this week / this month / next 30 days) and a max-price hint from the message. When it finds an auction intent it fetches `/api/auctions?upcoming=true&…&limit=6` **in parallel** with the model call and renders `AuctionCards` in the assistant turn, above the narrative.
- The Worker's `[[ACTION:…]]` directives still work: `filter_county` renders an "Open in Auctions" affordance rather than yanking the customer off the page mid-answer.
- Every card links to `/radar/<id>` (detail) and shows: address, county, sale date, type, opening bid, assessed value. Missing values are `—`, never 0.

## 5. Design tokens

Light (default): background `#f5f0e8`, card `#fbfaf7`, ink `#1f1b16`, muted `#766f67`, border `#ddd5c9`, primary `#c15f3c`.
Dark: background `#0b0f17`, card `#111827`, ink `#f3efe8`, muted `#a39c93`, border `#232b3a`, primary `#e07a52`.
Display type: Newsreader (serif, self-hosted via `next/font`); UI: Inter. Radius 12 px on cards, 16 px on the composer. Tap targets ≥ 44 px.

## 6. Out of scope (needs Worker / backend changes)

- Upstream `/chat/api` returns the whole answer as one SSE chunk and truncates around 1.5k characters; true token streaming and a higher output cap are Worker-side fixes.
- `properties` SSE event is still not emitted by the Worker on the probes run Sep 3; cards come from `/api/auctions` instead.
- Voice (ElevenLabs) remains CSP-blocked; the mic control stays visibly disabled.
