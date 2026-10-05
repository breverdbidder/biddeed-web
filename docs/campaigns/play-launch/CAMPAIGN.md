# BidDeed Field Play Launch Campaign — Offer Copy

**Status:** APPROVED by Ariel (2026-10-05) — Pay 1 month of Pro ($199), get 2 free (`MVP_PLAY_LAUNCH`).
**Do not** change live Stripe coupon/products or redeploy webhook from this docs PR.
**Do not** merge this PR until a human reviews; draft only.

---


**Campaign name:** BidDeed Field Play Launch  
**Offer:** Pay 1 month of Pro ($199), get 2 months free  
**Coupon / promo code:** `MVP_PLAY_LAUNCH`  
**CTA base URL:** `https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro`  
**Launch window:** Soft / Internal testing window (update dates when Ariel locks start/end)  
**One product story:** The Android app launch and the 1+2 Pro offer are the **same** campaign — not two promos.

---

## What Pro includes (one line)

**Pro ($199/mo):** Investor auction intel + D4D drive routes + full ZoneWise zoning per property + 30 SIGNAL$ reports / 15 skip traces / 3 county monitors.

---

## Honesty block (use everywhere)

- You pay **$199 once** for month 1. Months 2 and 3 are **free**. Starting month 4 you renew at **$199/mo** unless you cancel.
- Cancel anytime in the customer portal / Stripe billing before month 4 renews — no surprise lock-in.
- **BidDeed Field** (Android) is launching on **Google Play** as an **Internal / soft launch** while we finish listing and hosting. Store availability may be limited to testers first; Pro unlocks live on **biddeed.ai**, not as an in-app Play purchase.
- SIGNAL$ max-bid figures remain subject to product gating (withheld until model revalidation where stated on-site).

---

## Site banner (homepage / auctions)

**Short (≤90 chars):**  
Play launch: Pay 1 month of Pro ($199), get 2 free → Subscribe

**Medium:**  
**BidDeed Field is on Play (soft launch).** Launch offer: pay **$199** for Pro month 1, get **months 2 & 3 free**, then $199/mo. Cancel anytime.

**CTA label:** Claim Play launch Pro  
**CTA href:** `https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro`

---

## `/subscribe` page hero + checkout rail

**Eyebrow:** BidDeed Field · Play launch offer  
**Headline:** Pay 1 month. Get 2 free.  
**Subhead:** Pro is $199/mo. For the Field Android soft launch, pay month 1 now and we’ll cover months 2 and 3 — then Pro continues at $199/mo. Same offer whether you found us on Play or on the web.

**Bullets:**
- Month 1: **$199** charged today  
- Months 2–3: **$0**  
- Month 4+: **$199/mo** until you cancel  
- Field app: auction week, parcel underwrite, drive routes — Pro on the web; no Play in-app checkout  

**Primary CTA:** Start Pro — Play launch  
**URL:** `https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro`  
**Secondary:** See plans (scroll) · Privacy: `https://biddeed.ai/privacy`

**Fine print (under CTA):**  
Offer code `MVP_PLAY_LAUNCH`. Limited to the Play launch window. Not redeemable as cash. Android listing may be Internal testing / invite-only until production rollout.

---

## Email (launch announcement)

**Subject options:**
1. BidDeed Field on Play — pay 1 month of Pro, get 2 free  
2. Soft launch: $199 Pro month 1 → 2 months on us  
3. Field app is live for testers + the 1+2 Pro offer

**Body (plain text ready):**

```
Subject: BidDeed Field on Play — pay 1 month of Pro, get 2 free

Ariel here.

We're soft-launching BidDeed Field on Google Play — the Android app for
Florida auction week, parcel underwrite, and drive routes.

Same launch offer whether you come from Play or the web:

  Pay $199 for Pro month 1
  Get months 2 and 3 free
  Then $199/mo — cancel anytime before renewal

Pro = Investor intel + D4D field routes + ZoneWise zoning + 30 SIGNAL$
reports / month.

Claim it:
https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro

Play note: this is an Internal / soft launch first. Pro is billed on
biddeed.ai (Stripe) — not as a Play in-app purchase.

Privacy: https://biddeed.ai/privacy

— Ariel
BidDeed.AI
```

---

## X (Twitter) posts

**Post A (launch):**  
BidDeed Field is soft-launching on Google Play.  
Launch offer: pay **1 month of Pro ($199)**, get **2 months free**.  
Then $199/mo · cancel anytime.  
https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro

**Post B (product + offer):**  
Auction calendar → underwrite → drive route — on Android.  
Play launch promo = web Pro: **$199 month 1**, months **2–3 free**.  
https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro

**Post C (honesty):**  
No Play Billing in the shell yet. Pro unlocks on biddeed.ai.  
1 paid + 2 free for the Field soft launch.  
https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro

---

## LinkedIn

**Post:**

We’re soft-launching **BidDeed Field** on Google Play — a phone app for Florida foreclosure auction week, parcel underwrite, and D4D drive routes.

The launch offer is simple and the same on web and Play:

**Pay 1 month of Pro ($199) → get 2 months free → then $199/mo.** Cancel anytime.

Pro includes Investor auction intel, field routes, ZoneWise zoning, and 30 SIGNAL$ property reports per month.

Start here: https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro  

*(Internal / soft launch first; Pro is billed via Stripe on biddeed.ai, not Play in-app purchases.)*

---

## Play listing short description hook (optional, ≤80 chars)

Soft launch · Pro on web: pay $199 mo1, get 2 free

## Play listing full description opener (optional)

BidDeed Field brings Florida auction week, parcel underwrite, and drive routes to Android. During our soft launch, unlock Pro on biddeed.ai: pay $199 for month 1 and get months 2–3 free. Subscriptions are managed on the web (Stripe), not as Play in-app purchases.

---

## Do / Don’t

| Do | Don’t |
|---|---|
| Frame every channel as **Play launch = 1+2 Pro** | Run a separate “web only” 1+2 promo |
| Say Internal / soft launch until production is live | Promise “on Play Store for everyone today” if only Internal |
| Point checkout to biddeed.ai Stripe | Put a buy button / Stripe link inside the Play APK |
| State cancel + month-4 renewal clearly | Imply lifetime free or Pioneer forever |

