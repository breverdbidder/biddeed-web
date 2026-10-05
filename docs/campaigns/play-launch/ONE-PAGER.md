# One-pager — Play launch + 1+2 Pro (one campaign)

**Status:** APPROVED by Ariel (2026-10-05) — Pay 1 month of Pro ($199), get 2 free (`MVP_PLAY_LAUNCH`).
**Do not** change live Stripe coupon/products or redeploy webhook from this docs PR.
**Do not** merge this PR until a human reviews; draft only.

---


## The story in one breath

**BidDeed Field** is soft-launching on **Google Play**. The launch offer is not a second promo: everyone who shows up for Field — from a Play tester link or from the web — gets the same deal: **pay $199 for Pro month 1, get months 2 and 3 free, then $199/mo until you cancel.**

## Why this order

1. **Cash this week lives on Stripe / biddeed.ai**, where Pro already exists at $199/mo (`price_1ToWibKaSTwZgYdfZiWM5fdy`).  
2. **Field is the distribution wedge** — phone-shaped auction week, underwrite, and drive routes — but the APK is not a store cash register yet (no Play Billing / no in-app Stripe by design).  
3. **One SKU, one coupon story (`MVP_PLAY_LAUNCH`)** avoids training the market with conflicting Pioneer / random discount noise.

## Customer journey

```
Hear “Field is on Play (soft launch)”
        ↓
Install via Internal testing  —or—  land on biddeed.ai
        ↓
Use Field for calendar / parcel / route
        ↓
Unlock Pro on the web:
https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro
        ↓
Pay $199 → free months 2–3 → $199/mo (cancel anytime)
```

## What we say in public

| We say | We don’t say |
|---|---|
| Soft / Internal launch on Play | “Fully live on Play for everyone” before Production |
| Pay 1 month, get 2 free, then $199/mo | “3 months free” or “lifetime Pro” |
| Pro = routes + ZoneWise + reports | Vague “AI unlimited” |
| Billing on biddeed.ai (Stripe) | “Subscribe in the Play app” |

## What Pro is (marketing line)

Investor auction intel, plus **D4D field routes** and **ZoneWise zoning**, with **30 SIGNAL$ reports** a month.

## Operating rules

- **Same CTA everywhere:** `https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro`  
- **Same honesty block:** month-4 renewal + cancel anytime + privacy `https://biddeed.ai/privacy`  
- **Play shell:** ship Internal testing; keep purchases out of the APK (`PLAY-PAYMENTS.md`)  
- **Stripe:** schedule = paid month 1 → 100% off months 2–3 → full price; never a 3-month free coupon on first invoice (`STRIPE.md`)

## Success for this window

- Testers install Field from Play Internal.  
- At least one real **$199** Pro charge attributed to `MVP_PLAY_LAUNCH`.  
- Messaging on site / email / X / LinkedIn all describe **one** Play launch offer — not a web promo plus a separate app promo.

## Source docs in this folder

- `CAMPAIGN.md` — channel copy  
- `STRIPE.md` — billing mechanics  
- `PLAY-CHECKLIST.md` — builder-machine ship steps  
