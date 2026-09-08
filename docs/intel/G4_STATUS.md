# G4 STATUS — CMA Zillow & Realtor.com Source Expansion Scoping

**File:** `docs/intel/CMA_ZILLOW_REALTOR_SOURCING.md`  
**Updated:** 2026-09-08 (ET)  
**Directive:** BidDeed Multi-Model Parity Grok-lane G4  
**Honesty Protocol V3**  
**Constraints honored:** No signup, no spend, no ToS acceptance (public pages read only).

## Honesty summary

| Item | Tag | Notes |
|---|---|---|
| Legacy Zillow public Web Services API (ZWSID) retired; not available for new keys | VERIFIED (industry docs) + legacy terms page still live | https://www.zillowgroup.com/developers/terms/ |
| Bridge Interactive hosts Zillow Group datasets: Public Records, Zestimates, Econ | VERIFIED | https://www.bridgeinteractive.com/developers/zillow-group-data/ |
| Bridge FAQ: no local storage of Zillow API data; spiders prohibited; ≤1,000 calls/day/dataset after approval | VERIFIED | Same URL |
| Bridge charges no extra service fee for partner MLS integrations; MLS may bill | VERIFIED | https://bridgedataoutput.com/docs/platform/ |
| Dollar price for commercial Zestimate-in-SIGNAL$ | UNKNOWN | Quote: api@bridgeinteractive.com |
| Zillow Research aggregate CSVs free | VERIFIED (product existence); live HTML CAPTCHA-blocked from box | https://www.zillow.com/research/data/ |
| Zillow site ToS bans scraping / most redistribution; Aggregate Data exception with citation | VERIFIED via indexed ToS excerpts; full page CAPTCHA-blocked 2026-09-08 | https://www.zillow.com/corporate/terms-of-use/ |
| Legacy API ToS: no bulk, no retention, Property Details not for B2B service, max 20 props/page | VERIFIED full fetch | https://www.zillowgroup.com/developers/terms/ |
| Realtor.com open listing/sold/estimate developer API | VERIFIED absent (no public portal/rate card found) | — |
| Realtor.com Lead Delivery API = leads CRM only | VERIFIED | support.realtor.com Lead API articles |
| ListHub publisher path exists; RESO Web API; contact publisher.sales@listhub.com | VERIFIED | https://www.listhub.com/publishers/ |
| ListHub provides **no sold/off-market**; no resyndication; no paywall on ListHub data | VERIFIED | publishers + publisher-faqs |
| ListHub publisher dollar fee | UNKNOWN | Sales email |
| Move ToS bans scrape, redistribute, use on other apps; bans ML/AI/LLM use of Content | VERIFIED full fetch | https://www.realtor.com/terms-of-use/ |
| robots.txt scrape unauthorized without Move Sales written permission | VERIFIED | https://www.realtor.com/robots.txt |
| RealEstimate = up to 3 third-party AVMs on site | VERIFIED | https://www.realtor.com/estimates/ |
| 3 CMA tier definitions from Ariel | ASSUMED scaffold only | Awaiting Ariel lock |
| Scraping either portal for SIGNAL$ CMA | ToS-violating / rejected | Both ToS |

## Deliverable checklist

- [x] Public CMA surfaces for Zillow and Realtor.com
- [x] Official APIs / partner / licensing programs **with URLs as of 2026-09-08**
- [x] Field availability table marked VERIFIED vs INFERRED
- [x] Pricing: listed where public; else UNKNOWN + quote path
- [x] ToS / scrape / redistribution restrictions with citations; SIGNAL$ violation flags
- [x] Recommended legal paths (license vs MLS vs public records) — no unofficial scraper vendor names
- [x] 3 CMA tiers scoping table marked ASSUMED
- [x] No signup / no spend / no invented prices

## Paths written

- `/workspace/docs/intel/CMA_ZILLOW_REALTOR_SOURCING.md`
- `/workspace/docs/intel/G4_STATUS.md`

## Report-back (parent)

### Top recommended legal path per source

- **Zillow:** Apply to **Bridge Interactive** for Zestimates / Public Records / Econ **if** use case approved; run **MLS RESO/IDX** as true comps engine; use **Zillow Research** aggregates for market context. **Do not scrape.**
- **Realtor.com (Move):** Do **not** scrape. Evaluate **ListHub Publisher** for **active-only** inventory (knowing **no solds**). Deliver sold comps via **MLS + public records**. Pursue written Move license only if Realtor.com-branded estimates/history are mandatory.

### Public price points found

- Bridge Zillow FAQ: **1,000 calls/day/dataset** cap after approval — **no dollar rate card**.
- Bridge platform: **no additional Bridge service fee** for partner MLS integrations (MLS fees separate).
- Zillow Research CSVs: **free** (aggregate).
- ListHub: **free** basic syndication to MLS/brokers; **publisher fee to BidDeed = UNKNOWN** (`publisher.sales@listhub.com`).
- Realtor.com Lead API / advertising: not a listing CMA feed; no public listing-data price.

### Biggest ToS blockers for in-product SIGNAL$ CMA

1. **Both sites prohibit scraping** and redistribution onto other apps/products without written permission.
2. **Zillow/Bridge:** no local storage of API Zillow data; legacy API hostility to bulk + B2B Property Details packaging.
3. **Move/Realtor.com:** explicit ban on using Content for **ML/AI/LLM** training/fine-tuning/grounding; ListHub **cannot** supply sold comps and forbids paywalling ListHub data / resyndication.

---

*End of G4_STATUS.md — 2026-09-08 ET*
