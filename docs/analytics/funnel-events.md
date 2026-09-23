# biddeed.ai funnel events - contract v1

Issue #181. Source of truth in code: `lib/analytics/funnel.ts` (`FUNNEL_EVENTS`, `ALLOWED_PROPS`, `sanitizeProps`). Every event carries `event_version: 1` and `path` (pathname only, never a query string). PostHog project 354627.

| Event | Fires when | Properties |
|---|---|---|
| `report_viewed` | A visitor opens a SIGNAL$ Property Report from this app: the free-report popup's "Open my free report", or any link to `/report/<id>` | `report_type` (`sample` \| `paid`), `surface` (`free_report_popup` \| `link`) |
| `checkout_started` | Stripe checkout URL came back and the browser is about to redirect | `product` (`signal_report` \| `subscription` \| `pioneer_pro`), `plan`, `interval`, `price_usd`, `currency`, `county`, `sale_type`, `surface` |
| `purchase_completed` | Success page confirmed a paid session (`/success`, `/pioneers/success`) | `product`, `plan`, `currency`, `surface` |
| `signup_completed` | First signed-in load of a Clerk account created in the last 30 minutes, once per account per browser, right after `identify` | `method` (`oauth` \| `email`) |
| `lead_captured` | Free-report popup accepted an email | `surface`, `digest_opt_in`, `stored` (the lead list accepted the write) |
| `free_report_popup_shown` | Popup opened | `surface`, `trigger` (`timer` \| `scroll` \| `exit_intent`) |
| `free_report_popup_dismissed` | Popup closed without submitting | `surface` |
| `signup_prompt_clicked` | "Create a free account" in the popup or on `/buy-report` | `surface` |

The older `checkout_completed` event (with Stripe `session_id`) still fires next to `purchase_completed` so existing insights keep working.

## Funnels this enables

1. `free_report_popup_shown` -> `lead_captured` -> `report_viewed` (sample) -> `signup_completed`
2. `$pageview /buy-report` -> `checkout_started` (signal_report) -> `purchase_completed`
3. `$pageview /pricing` -> `checkout_started` (subscription) -> `purchase_completed`

Test traffic: filter out persons whose email ends in `@e2e.biddeed.ai` and internal accounts before reading any of these.

## Privacy boundary

- Do Not Track or Global Privacy Control: PostHog is not loaded at all (no pageviews, no autocapture, no named events). `respect_dnt: true` is also set in `init` as a second guard.
- Visitors who opted out of PostHog capture send nothing.
- Only the keys above are ever sent. `sanitizeProps` drops any other key and any value that looks like an email, phone number, API key/token, or URL with a query string. `npm run test:funnel-events` fails if that stops being true.
- Email is never an event property. It stays a PostHog person property from `identify` for signed-in accounts, for the owner-requested registered-user digest.

## Lead capture

`POST /api/leads/free-report` writes into `lead_profiles` through the existing `upsert_lead_full` RPC with `source = 'popup_free_report'`. Marketing consent (`email_consent`) is set only when the visitor ticks the optional digest box, which is unticked by default. SMS consent is never set.
