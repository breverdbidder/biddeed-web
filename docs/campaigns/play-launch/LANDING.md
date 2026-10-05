# Landing / banner / subscribe copy — `MVP_PLAY_LAUNCH`

**Status:** APPROVED by Ariel (2026-10-05).

Live implementation already on `main` (this file is the copy SSOT for review; do not redeploy from this PR).

## Banner (live: `PlayLaunchBanner.tsx`)

**Visible text / CTA:**  
`Play launch: Pay 1 month of Pro ($199), get 2 free → Subscribe`

**Href:** `/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro`  
**Behavior:** Hidden on `/sign-in` and `/sign-up`; dismissible via `localStorage` `biddeed.playLaunchBanner.v1`.

## Subscribe rail when `?promo=MVP_PLAY_LAUNCH&tier=pro` (live: `SubscribeCheckout.tsx`)

- Forces **monthly** Pro (annual toggle disabled for this promo).
- Shows play-launch honesty copy (month 1 $199 → months 2–3 free → then $199/mo).
- Passes `promo` to checkout API; does **not** apply Stripe discounts in the browser.

## Full channel kit

See `CAMPAIGN.md` for homepage variants, email/X/LinkedIn drafts (unsent — Ariel must approve any send), and Do/Don’t table.

## Play Store listings

Do **not** paste price/promo offers into Google Play listing text without a separate payments-policy review. Field APK purchase-link hiding is a separate draft PR stack.
