# Play launch campaign pack (`MVP_PLAY_LAUNCH`)

**Status:** APPROVED by Ariel (2026-10-05) — Pay 1 month of Pro ($199), get 2 free.
**Billing sequence:** **Verified in Stripe test mode** (test clock; bills $199 → $0 → $0 → $199; subscription stays active). Proof: [Actions run 37353861378](https://github.com/breverdbidder/cli-anything-biddeed/actions/runs/37353861378). **Not yet verified:** deployed webhook on a real checkout. Do **not** change Stripe/billing, merge, or redeploy from this PR.

This folder is the **campaign structure backup** (copy, fulfillment rules, tracking map).  
Billing code and site banner/checkout already shipped on `main` — this draft PR documents them; it does **not** merge, redeploy, or change Stripe.

## Offer

| Field | Value |
|---|---|
| Promo / coupon | `MVP_PLAY_LAUNCH` |
| CTA | `https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro` |
| Economics | Month 1 **$199** → months 2–3 **$0** → month 4+ **$199/mo** |
| Product | Pro monthly (`price_1ToWibKaSTwZgYdfZiWM5fdy` — public id already in codebase) |

## Structure map (live code on main — do not recreate here)

| Layer | Location | Role |
|---|---|---|
| Landing / banner copy | `components/shell/PlayLaunchBanner.tsx` | Site-wide strip → subscribe CTA |
| Checkout UI | `components/subscribe/SubscribeCheckout.tsx` | Forces monthly Pro when `promo=MVP_PLAY_LAUNCH`; passes `promo` to API |
| Subscribe page | `app/subscribe/page.tsx` | Hosts checkout |
| Checkout Worker | `cli-anything-biddeed` → `supabase/functions/biddeed-checkout` | Session + `subscription_data.metadata.promo/campaign` |
| Fulfillment | `cli-anything-biddeed` → `supabase/functions/stripe-webhook` + `play-launch-schedule.js` | After paid month 1, schedule 2 free then release |
| Unit tests | `cli-anything-biddeed` → `tests/play-launch-schedule.test.js` | Phase shape / eligibility |
| Channel copy | `CAMPAIGN.md` | Banner, subscribe hero, email/X/LinkedIn drafts (unsent) |
| Narrative | `ONE-PAGER.md` | Single-campaign story |
| Fulfillment rules | `STRIPE.md` | Correct schedule economics; anti-patterns |
| Tracking | `TRACKING.md` | Attribution fields + success checks |
| Landing copy SSOT | `LANDING.md` | Banner + subscribe rail text vs live component |

## Docs in this folder

- `CAMPAIGN.md`
- `ONE-PAGER.md`
- `STRIPE.md`
- `TRACKING.md`
- `LANDING.md`

## Out of scope for this PR

- Creating/editing Stripe coupons or products
- Redeploying `stripe-webhook` or Workers
- Sending email / inviting Play testers
- Merging to `main`
