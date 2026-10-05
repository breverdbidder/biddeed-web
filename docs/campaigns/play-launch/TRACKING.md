# Tracking — `MVP_PLAY_LAUNCH`

**Status:** APPROVED by Ariel (2026-10-05). Docs only; no analytics pipeline changes in this PR.

## Attribution fields (already written by live checkout)

| Field | Where set | Value for this campaign |
|---|---|---|
| `promo` | Checkout Session + Subscription metadata | `MVP_PLAY_LAUNCH` |
| `campaign` | Same (when promo is play launch) | `play_launch` |
| `tier_id` | Checkout metadata | `pro` |
| `billing_interval` | Checkout metadata | `monthly` (forced for this promo) |
| `customer_email` | Checkout payload | customer-provided |
| `visitor_id` / `referral_code` | Optional passthrough from web | when present |

Source (do not change from this docs PR):

- Web: `components/subscribe/SubscribeCheckout.tsx` — `track(...)` on checkout submit includes `promo` when present; POSTs `promo` to `/subscribe/checkout`.
- Worker: `biddeed-checkout` — `metadata[promo]`, `subscription_data[metadata][promo]`, and when promo is `MVP_PLAY_LAUNCH` also `metadata[campaign]=play_launch`.
- Webhook: `play-launch-schedule.js` — reads subscription/session metadata `promo`; stamps schedule when eligible.

## Banner engagement (client-only today)

- Dismiss key: `localStorage` key `biddeed.playLaunchBanner.v1` = `dismissed`
- No server-side banner impression event documented in this pack; funnel `track` on subscribe submit is the primary conversion signal.

## Success checks (ops, not automated here)

1. At least one live Subscription with `metadata.promo=MVP_PLAY_LAUNCH` and Pro monthly price.
2. First invoice **$199** paid; schedule phases: paid current → 2× 100% `MVP_PLAY_LAUNCH` → release to full price.
3. Site CTA still lands on `/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro`.

## Gaps (review-branch note only — no code in this PR)

- No dedicated PostHog/funnel event name exclusively for `play_launch_banner_click` is required for launch; optional follow-up.
- Retention of chat/`ask` payloads is unrelated to this campaign and tracked in Field Data safety docs.
