# Stripe / fulfillment rules — Pay $199 → 2 months free → $199/mo

**Status:** APPROVED by Ariel (2026-10-05) — Pay 1 month of Pro ($199), get 2 free (`MVP_PLAY_LAUNCH`).
**Do not** change live Stripe coupon/products or redeploy webhook from this docs PR.
**Do not** merge this PR until a human reviews; draft only.

**Implementation status (verified in repo, not changed by this PR):**
- Coupon id `MVP_PLAY_LAUNCH` is live in Stripe (do not recreate via API from this task).
- Webhook schedule automation: `cli-anything-biddeed` `supabase/functions/stripe-webhook/` + `play-launch-schedule.js` (already merged).
- Checkout attribution: `biddeed-checkout` writes `metadata.promo` / `metadata.campaign=play_launch`.
- Site CTA: `components/shell/PlayLaunchBanner.tsx` + `components/subscribe/SubscribeCheckout.tsx` (already on main).
- This file is the **canonical fulfillment rules doc**. Do not alter Stripe settings from this PR.

---


**Offer:** Play launch Pro (`MVP_PLAY_LAUNCH`)  
**List price:** Pro **$199/month**  
**Known live price id (prior research / codebase):** `price_1ToWibKaSTwZgYdfZiWM5fdy`  
**Verify in Dashboard** before wiring: Products → Pro → recurring monthly $199 → confirm id matches.  
**(Related annual Pro id seen in codebase:** `price_1ToWigKaSTwZgYdfO4jTa0po` — **do not use** for this monthly launch offer.)

Promo query customers hit:  
`https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro`

---

## Critical warning — do **not** use a naive “100% off for 3 months”

| Bad pattern | Why it breaks the offer |
|---|---|
| Coupon `percent_off=100`, `duration=repeating`, `duration_in_months=3` applied at checkout | **Month 1 is free** — they never pay $199 “now” |
| Coupon `duration=once` at 100% | Only first invoice free; months 2–3 still bill $199 |
| Free trial of 2 months then first charge | Cash arrives late; not “pay one month now” |
| Forever / forever-ish 100% coupon | Destroys ARPU; not this campaign |

**Correct economics:**

| Period | Customer pays |
|---|---|
| Month 1 (day 0) | **$199** |
| Months 2–3 | **$0** |
| Month 4 onward | **$199/mo** until cancel |

---

## Recommended approach: Subscription Schedule (Dashboard or API)

This is the clean implementation. Payment Links alone cannot express multi-phase pricing well.

### A. Create the coupon (for phases 2–3 only)

1. Stripe Dashboard → **Product catalog → Coupons → Create**.
2. Settings:
   - **Name:** `MVP_PLAY_LAUNCH` (display)
   - **ID:** `MVP_PLAY_LAUNCH` (exact)
   - **Type:** Percentage discount → **100%**
   - **Duration:** **Repeating** → **2** months  
     *(Only attach this coupon on schedule phases that should be free — never as the default checkout discount on phase 1.)*
   - Redemption limits: optional max redemptions / expiry matching launch window
   - Applies to: Pro product / `price_1ToWibKaSTwZgYdfZiWM5fdy` only if you want to lock scope

### B. Subscription Schedule shape (per customer)

When a launch checkout completes for Pro monthly:

1. **Phase 1** — iterations = **1**  
   - Item: `price_1ToWibKaSTwZgYdfZiWM5fdy`  
   - Discounts: **none**  
   - → Invoice #1 = **$199**

2. **Phase 2** — iterations = **2**  
   - Item: same Pro price  
   - Discount: coupon `MVP_PLAY_LAUNCH` (100% × 2 months)  
   - → Invoices #2 and #3 = **$0**

3. **Phase 3** — no end (or `end_behavior=release`)  
   - Item: same Pro price  
   - Discounts: **none**  
   - → Invoice #4+ = **$199/mo**

`end_behavior`: prefer **`release`** so after the free phases the subscription continues as a normal Pro sub the customer can cancel in the portal.

### C. How to attach the schedule in practice

**Option 1 — Manual / concierge (fastest today, few customers):**  
1. Use existing Pro Checkout / Payment Link for `price_1ToWibKaSTwZgYdfZiWM5fdy` so month 1 charges **$199**.  
2. Immediately after successful subscription create: Dashboard → Subscription → **Update subscription** / **Create schedule from subscription**.  
3. Add Phase 2 (2× months, 100% `MVP_PLAY_LAUNCH`) then Phase 3 (full price).  
4. Confirm upcoming invoice preview: $199 → $0 → $0 → $199.

**Option 2 — Checkout + webhook (scalable):**  
1. Checkout Session `mode=subscription`, `line_items=[{ price: price_1ToWibKaSTwZgYdfZiWM5fdy, quantity: 1 }]`, metadata `{ promo: "MVP_PLAY_LAUNCH", campaign: "play_launch" }`.  
2. **Do not** pass `discounts` / `allow_promotion_codes` that apply 100% on the first invoice.  
3. On `checkout.session.completed` / `customer.subscription.created`, create a **Subscription Schedule** from that subscription with the three phases above.  
4. Entitlement: keep existing Pro tier mapping for `price_1ToWibKaSTwZgYdfZiWM5fdy` (already mapped to `pro` in BidDeed/ZoneWise webhook maps).

**Option 3 — Payment Link (marketing only):**  
- A standard Payment Link can collect the **first** $199 Pro month.  
- It **cannot** alone encode “then 2 free then full.” Pair every Payment Link signup with Option 1 or 2 schedule attachment, or do not advertise 1+2 until automation exists.

Suggested Payment Link naming (if used as front door):  
`BidDeed Pro — Play launch (pay month 1; 2 free applied after signup)`  
URL can still be wrapped by:  
`https://biddeed.ai/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro`

---

## Invoice / Customer Portal copy

- Portal: customers cancel before the month-4 renewal to avoid the next $199 charge.  
- Receipt description suggestion: `BidDeed.AI Pro — Play launch (MVP_PLAY_LAUNCH)`.  
- Do not put Play Store as the merchant of record; Stripe on biddeed.ai remains MoR.

---

## Test checklist (test mode first)

1. Create test clock or short-lived test sub.  
2. Phase 1 invoice = **$199** paid.  
3. Advance to phase 2 → two **$0** invoices (or 100% discounted).  
4. Phase 3 → **$199** invoice.  
5. Cancel in portal during phase 2 → no month-4 charge.  
6. Confirm webhook still sets tier = `pro` for the whole schedule (price id unchanged).  
7. Confirm coupon is **not** redeemable as a naked code that zeros month 1 on `/subscribe` without the schedule.

---

## Anti-patterns to refuse in review

- “Just make a 3-month 100% coupon”  
- “Trial 90 days then bill” (wrong cash timing + wrong story)  
- “Annual Pro at $199” (wrong price id / product)  
- Mixing Pioneer ($990 forever) messaging into this Play launch offer
