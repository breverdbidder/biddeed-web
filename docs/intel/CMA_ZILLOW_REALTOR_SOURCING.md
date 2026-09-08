# CMA Source Expansion Scoping: Zillow & Realtor.com (Move / News Corp)

**Lane:** BidDeed.AI Grok-lane G4  
**Directive (Ariel):** "All Zillow and Realtor should be part of our CMA we provide in our SIGNAL$ on the 3 CMA tiers."  
**Updated:** 2026-09-08 (ET)  
**Honesty Protocol V3** — research/report only; no signup, no purchase, no ToS acceptance. Reading public legal/developer pages is OK. Ariel approves spend over $10.

**Scope note:** This brief scopes what is **legally and technically available TODAY** for in-product SIGNAL$ CMA use. It does **not** recommend scraping either site.

---

## Executive summary (parent report-back)

| Source | Top recommended **legal** path | Public price points found | Biggest ToS / product blockers for SIGNAL$ CMA |
|---|---|---|---|
| **Zillow Group** | (1) Apply via **Bridge Interactive** for approved Zillow Group datasets (Zestimates / Public Records / Econ) **if** use case survives review; (2) obtain **MLS comps** via RESO/Bridge or brokerage IDX (not “Zillow scrape”); (3) use **Zillow Research** free **aggregate** CSVs for market context only. | Bridge FAQ: **max 1,000 calls/day per dataset** after approval; Bridge docs state Bridge charges **no additional service fees** for partner MLS integrations (MLS may still bill). **Zillow proprietary dataset commercial price: UNKNOWN** — quote via `api@bridgeinteractive.com`. Research CSVs: **free** download (aggregate only). | Site ToS bans automated scraping & most redistribution; Bridge FAQ bans **local storage** of Zillow API data; legacy Zillow API ToS bans bulk, retention, and (Property Details) **B2B service** use; Zestimate/listing scrape for CMA = **ToS-violating**. |
| **Realtor.com (Move / News Corp)** | (1) **Do not scrape** Realtor.com; (2) for **active** marketing listings only, evaluate **ListHub Publisher** contract (`publisher.sales@listhub.com`); (3) for **sold comps** (CMA-critical), use **MLS** + **public records** — ListHub explicitly has **no sold/off-market**. Realtor.com Lead API is **leads CRM only**, not listing/CMA data. | ListHub: **no public rate card** for publishers. Public statement: ListHub does **not charge MLS/brokers** for basic syndication. Publisher fee to BidDeed: **UNKNOWN** — sales email. Lead Delivery API: product for paying Realtor.com advertiser clients; not a listing feed. | Move ToS bans scrape/redistribute/display on other apps **and** bans use of Content for **ML/AI/LLM** training/grounding; robots.txt asserts scrape unauthorized without written permission; **no open listing API**; ListHub **no sold data** + **no resyndication** + **no paywall** on ListHub data. |

---

## 1. Zillow Group

### 1.1 Public product surfaces relevant to CMA

| Surface | What it shows (CMA-relevant) | Tag | Citation |
|---|---|---|---|
| Property detail pages (zillow.com) | List/sale context, beds/baths/sqft, photos, price history, tax history, Zestimate | VERIFIED (product pages / Zillow Learn) | https://www.zillow.com/zestimate/ ; https://www.zillow.com/learn/real-estate-comps/ |
| Recently Sold / sold search filters | Consumer UI for recently sold homes as comps starting point | VERIFIED | https://www.zillow.com/learn/real-estate-comps/ |
| Zestimate® / home value estimator | Proprietary AVM; history charts; not an appraisal | VERIFIED | https://www.zillow.com/zestimate/ ; https://www.zillow.com/how-much-is-my-home-worth/ |
| Zillow Research Housing Data | **Aggregate** indexes (ZHVI, inventory, DOM metrics, etc.) by geo — **not** parcel-level comps | VERIFIED | https://www.zillow.com/research/data/ (page exists; live fetch CAPTCHA-blocked 2026-09-08 from box; CDN CSV pattern widely documented) |
| Agent / Pro CMA workflows | Zillow markets agents pulling MLS CMAs; consumer comps guidance | VERIFIED / INFERRED for product positioning | https://www.zillow.com/learn/real-estate-comps/ |

**Important:** Public UI visibility ≠ license to ingest into SIGNAL$. Site ToS and API terms control redistribution (see §1.5).

### 1.2 Official APIs / partner / data-licensing programs (TODAY)

| Program | Status TODAY | What it covers | URLs |
|---|---|---|---|
| **Legacy Zillow Web Services API (ZWSID)** | **Retired** (industry reporting: public consumer API shut down ~2021-09-30) | Historical Home Valuation / Property Details / etc. — **not available for new keys** | Historical terms still published: https://www.zillowgroup.com/developers/terms/ ; overview path referenced in those terms: `www.zillow.com/howto/api/APIOverview.htm` (legacy) |
| **Bridge Interactive — Zillow Group datasets** | **Live** application path | **Public Records (US)**, **Zestimates**, **Zillow Group Econ Data** (programmatic form of research metrics) | https://www.bridgeinteractive.com/developers/zillow-group-data/ ; docs portal https://bridgedataoutput.com/docs/platform/ ; contact `api@bridgeinteractive.com` |
| **Bridge Interactive — MLS / RESO Web API** | **Live** for MLS-affiliated / approved vendors | MLS listing data via RESO Web API / Bridge Web API / RETS (provider-dependent) | https://bridgedataoutput.com/docs/platform/ ; https://www.bridgeinteractive.com/ |
| **Zillow Partnership Platform (MLS → Zillow)** | **Live** (inbound feed **to** Zillow, not outbound listing API for BidDeed) | MLSs send direct feeds **to** Zillow | https://www.zillow.com/mls-partners/ |
| **Zillow Research CSV downloads** | **Live** free aggregate files | Market metrics CSVs (not address-level CMA comps) | https://www.zillow.com/research/data/ ; files commonly served from `files.zillowstatic.com/research/public_csvs/` (secondary docs) |

**Bridge Zillow Group datasets (VERIFIED from Bridge page):**

- **Public Records:** property records, tax assessments, transaction records — Bridge claims ~148M properties / ~3,200 counties.  
- **Zestimates:** “all current Property and Rental Zestimates available on Zillow.com.”  
- **Econ Data:** housing market metrics otherwise available as CSVs on zillow.com/research/data.  

Source: https://www.bridgeinteractive.com/developers/zillow-group-data/

### 1.3 Typical CMA fields — VERIFIED vs INFERRED

| Field | On public Zillow UI | Via Bridge Zillow datasets (if approved) | Tag |
|---|---|---|---|
| List / sale price | Shown on listings / sold views | Public Records: transaction records described; listing feed is **MLS path**, not Zillow scrape | UI: VERIFIED; Bridge PR: VERIFIED description |
| Beds / baths / sqft | Shown on PDP | Property attributes appear in legacy API design; Bridge PR “property records” — exact field list **not fully published** on FAQ page | UI: VERIFIED; API field map: INFERRED / UNKNOWN without approved docs |
| DOM | Often shown on listings | Econ/aggregate metrics include market DOM series on Research; listing-level DOM = MLS-oriented | Aggregate: VERIFIED Research; listing DOM: INFERRED from UI |
| Photos | Shown on PDP | **Not** described as part of Zestimates/Public Records/Econ Bridge packages on the FAQ page | UI: VERIFIED; Bridge package: UNKNOWN / likely not for Zestimate API |
| Zestimate / Rent Zestimate | Core product | **VERIFIED** Bridge “Zestimates” API returns current Zestimates | VERIFIED |
| Comp set / nearby solds | Consumer Recently Sold UI | **No** public “comps API” documented on Bridge Zillow FAQ | UI: VERIFIED; API comps endpoint: UNKNOWN / not listed |

### 1.4 Pricing / commercial terms

| Item | Publicly listed? | What is known | How to get a quote |
|---|---|---|---|
| Bridge Zillow Group datasets | **Partial** | After approval: **max 1,000 calls/day per dataset** (FAQ). Storage of Zillow data via API: **not permitted** (FAQ). | Email `api@bridgeinteractive.com` — https://www.bridgeinteractive.com/developers/zillow-group-data/ |
| Bridge MLS platform fees | **Partial** | Bridge docs state Bridge does **not** charge vendors/brokerages **additional service fees** for partner MLS integrations; **MLSs may charge their own licensing fees**. | MLS / Bridge dashboard invitation process — https://bridgedataoutput.com/docs/platform/ |
| Dollar price for Zestimate commercial redistribution into a paid SIGNAL$ CMA | **UNKNOWN** | No public rate card found in this pass. Approval is use-case gated. | Same Bridge email; expect Data Terms / display rules review |
| Zillow Research CSVs | Free download (aggregate) | No per-call price; commercial attribution expectations historically cited by secondary sources — **confirm on page / counsel before heavy commercial embedding** | https://www.zillow.com/research/data/ |

**No invented prices.** Any third-party “Zillow API wrapper” pricing is **out of scope** for official licensing and is **not** a Zillow license.

### 1.5 ToS / scraping / redistribution (public legal pages)

**A. Zillow site Terms of Use** — https://www.zillow.com/corporate/terms-of-use/ (also mirrored paths such as `/z/corp/terms/`)

- Live full-page fetch from this box on **2026-09-08** was **CAPTCHA / bot-blocked** (PerimeterX). Claims below are from **publicly indexed excerpts** of that ToS (treat as cite-to-URL; re-verify in browser before contracting).
- Indexed provisions (HIGH RISK for SIGNAL$):
  - Prohibits **automated queries** including screen/database scraping, spiders, robots, crawlers, CAPTCHA bypass.
  - Content copy limited to **non-automated** personal/Pro use for view/save/print/fax/email.
  - **Aggregate Data** on Zillow Local-Info pages may be used for non-personal uses (e.g., market analysis) **with citation** (“Data Provided by Zillow Group”); **other** Zillow Companies’ data display needs **prior written approval**.
  - MLS-related language in indexed summaries: restrictions on copying/retransmitting listing data except as necessary for considering purchase/sale of an individual property.

**B. Zillow API / Data Terms (legacy published terms)** — https://www.zillowgroup.com/developers/terms/ (**VERIFIED full fetch 2026-09-08**)

Even if the old public ZWSID program is retired, these terms show Zillow’s licensing posture for approved API data:

- Distribute Zillow Data to consumers for **personal use without charge** on approved Sites; branding/display requirements apply.
- **Transactional** presentation only — **no bulk** user access.
- **May not retain copies** — direct server calls; distribute immediately.
- May not extract data elements to enhance third-party data files.
- Home Valuations / Property Details: **1,000 calls/day** default.
- Property Details API specifically: **may not use Zillow Data to provide a service for other businesses**; max **20 properties** at a time per user; must prevent bulk download/scraping of your implementation.

**C. Bridge Zillow Group FAQ** — https://www.bridgeinteractive.com/developers/zillow-group-data/ (**VERIFIED**)

- **No local storage** of Zillow data retrieved through Bridge API — retrieve/display dynamically only.
- Reverse engineering / spiders / pulling without Bridge API = ToS violation.
- Must include appropriate **links back to Zillow**.
- Registration open to public application; use case must meet Terms of Use.

#### What would be illegal or ToS-violating for in-product SIGNAL$ CMA

| Practice | Assessment | Tag |
|---|---|---|
| Scraping zillow.com (or using intermediaries to scrape) to populate SIGNAL$ CMA comps / Zestimates / photos | **ToS-violating** under site Terms; civil breach risk; may also implicate MLS content owners’ rights | VERIFIED (site ToS prohibition language via indexed excerpts + Bridge FAQ) |
| Storing Zestimate/API payloads in BidDeed DB for later CMA packs | **ToS-violating** under Bridge FAQ (“not permitted to store information locally”) and legacy API “no retain copies” | VERIFIED |
| Using Property Details–style Zillow Data as a **B2B** valuation service for other businesses | **ToS-violating** under legacy Property Details API terms | VERIFIED (legacy API ToS) |
| Redistributing listing photos/MLS text scraped from Zillow without MLS/publisher license | **ToS-violating** + likely **MLS license** violation (INFERRED for MLS layer; site ToS VERIFIED against scrape/redistribute) | Mixed |
| Citing Zillow Aggregate / Research metrics with required attribution in market charts | Potentially **permitted** under Aggregate Data / Research pathways — still confirm current page language + counsel | INFERRED / needs counsel |

### 1.6 Recommended BidDeed path options (Zillow) — risk notes

| Option | Fit for SIGNAL$ CMA | Risk notes |
|---|---|---|
| **A. Official Bridge Zillow Group license** (Zestimates ± Public Records ± Econ) | Best **official** path to put “Zillow” estimate / PR signals in-product **if approved** | Approval uncertain for competitive CMA product; **no storage** constrains architecture (live fetch / ephemeral); call caps; branding/links; may still disallow paid B2B packaging — **UNKNOWN until quote/ToS**. |
| **B. MLS via RESO / Bridge / brokerage** (comps source of truth) | Best path for **sold + active comps**, DOM, photos under real licenses | Not “Zillow data”; do not brand as Zillow. Per-MLS fees UNKNOWN; participation rules apply. |
| **C. Public records only** (county/assessor + Bridge PR if licensed) | Solid for **sale price / tax / transaction** skeleton comps | Weak on photos, DOM, agent remarks, condition; coverage varies by county. |
| **D. Zillow Research aggregates only** | Good for **tier market context** (ZHVI, inventory), not parcel comps | Free; not a substitute for address-level CMA. |
| **E. Scrape / unofficial wrappers** | **Rejected** for SIGNAL$ | Clear ToS violation; enforcement history industry-wide; Ariel honesty protocol + legal risk. |

**Top recommended legal path (Zillow):** Pursue **Option A application** (Bridge) **in parallel with Option B (MLS)** for real comps; use **Option D** for market backdrop. Do **not** scrape. Expect counsel review before any paid SIGNAL$ packaging of Zestimate.

---

## 2. Realtor.com (Move, Inc. / News Corp)

### 2.1 Public product surfaces relevant to CMA

| Surface | What it shows (CMA-relevant) | Tag | Citation |
|---|---|---|---|
| Listing search & detail pages | Active listings: price, beds/baths/sqft, photos, status, agent/broker attribution | VERIFIED | https://www.realtor.com/ (product); ToS governs reuse: https://www.realtor.com/terms-of-use/ |
| Just Sold / sold & property history | Sold price, public-record/MLS-sourced history, tax history (jurisdiction-dependent) | VERIFIED (example PDPs / product behavior; secondary guides) | Example detail pattern on realtor.com; history disclaimer on PDPs |
| RealEstimate℠ | Up to **three** third-party AVMs (providers named on estimates page: Collateral Analytics / Cotality lineage, CoreLogic, Quantarium) | VERIFIED | https://www.realtor.com/estimates/ |
| Neighborhood / market content | Consumer market context | VERIFIED as product surface | Site IA |

Again: UI ≠ redistribution license.

### 2.2 Official APIs / partner / data-licensing programs (TODAY)

| Program | Status TODAY | CMA relevance | URLs |
|---|---|---|---|
| **Open Realtor.com listing / sold / estimate developer API** | **Does not exist** as a public self-serve product (no key portal / rate card found) | N/A — structural: MLS-licensed inventory | Secondary industry explainers; no Move developer listing API found in this pass |
| **Lead Delivery API** | **Live** for Realtor.com advertiser clients (Connections℠ Plus / related lead products) | **Not** a CMA/listing feed — CRM lead ingest | https://support.realtor.com/s/lead-api-integration ; https://moveinc.my.site.com/Support/s/article/lead-delivery-api-integration |
| **ListHub (Move)** — Publisher syndication | **Live** RESO Web API for approved **publishers** | **Active** listings (+ contingent/pending accepting backups); **explicitly no sold/expired/withdrawn**; no historical listing archive in feed | https://www.listhub.com/publishers/ ; https://www.listhub.com/publisher-faqs/ ; https://www.listhub.com/publisher-resources/ ; sales: `publisher.sales@listhub.com` |
| **ListHub** — Broker/MLS syndication into publishers | **Live**; free basic syndication to MLS/brokers per public “How ListHub Works” | Inbound to ListHub, not BidDeed license by itself | https://www.listhub.com/how-listhub-works/ |
| **MLS direct / IDX / RESO** | Industry standard path | True sold+active comps for CMA | Per-MLS (not Realtor.com-branded) |
| **RDC / co-marketing / advertising partner programs** | B2B commercial (advertising, leads) | Generally **not** programmatic sold-comp CMA licensing | Realtor.com marketing / partner sales channels (no public data API rate card found) |
| **NAR / RPR** (context) | REALTOR® member tools | Separate from Move listing API; membership-gated | Industry context only |

**ListHub compliance highlights (VERIFIED)** — https://www.listhub.com/publishers/ ; https://www.listhub.com/publisher-faqs/

- No **resyndication**.
- **Sold and off-market not provided**; purge when listing leaves feed.
- Consumer-facing site; ListHub data **may not be charged for behind a paywall** (forced free login OK).
- Display minimums, ListingURL redirect, lead copy to listing agent, metrics JS required.
- Photos/videos/tours provided as URLs when source supplies them.
- Typical listing fields when source supplies: ListPrice (with display security flags), beds/baths/etc. per RESO schema — **field population varies by MLS**.

### 2.3 Typical CMA fields — VERIFIED vs INFERRED

| Field | On public Realtor.com UI | Via ListHub (if publisher) | Via Lead API | Tag |
|---|---|---|---|---|
| List price | Yes | Yes (subject to Internet display / security flags) | Listing URL / meta for **leads**, not inventory feed | VERIFIED |
| Sale / sold price | Yes (history / sold views) | **No** (explicit FAQ) | No | UI: VERIFIED; ListHub sold: VERIFIED absent |
| Beds / baths / sqft | Yes | Typically yes if MLS provides (schema-driven) | Not CMA inventory | UI: VERIFIED; ListHub: VERIFIED “if available from source” |
| DOM | Often shown | List date / status fields if provided; compute DOM yourself | No | UI: INFERRED common; ListHub: INFERRED from timestamps |
| Photos | Yes | **VERIFIED** URLs in feed | No | VERIFIED |
| RealEstimate / AVMs | Yes (third-party) | Not a ListHub sold AVM product for publishers; InternetAutomatedValuationDisplayYN flags exist for display rules | No | UI: VERIFIED; redistribution license: UNKNOWN / not public |

### 2.4 Pricing / commercial terms

| Item | Publicly listed? | What is known | How to get a quote |
|---|---|---|---|
| ListHub publisher access | **No public dollar rate card** | Vetting + contract; RESO Web API; CDN photo hosting priced via account manager (FAQ: “speak with your account manager”) | `publisher.sales@listhub.com` — https://www.listhub.com/publishers/ |
| ListHub to MLS/brokers (syndication out) | Free basic service (public claim) | Does not equal BidDeed publisher rights | https://www.listhub.com/how-listhub-works/ |
| Realtor.com Lead Delivery API | Tied to paid lead products | Not listing/CMA licensing | Realtor.com dashboard / Move Sales T&Cs linked from support articles |
| Parcel-level RealEstimate commercial redistribution | **UNKNOWN** | Estimates page describes consumer display of third-party AVMs; no public license to rehost in SIGNAL$ | Contact Move / valuation providers directly; **do not scrape** |

**No invented prices.**

### 2.5 ToS / scraping / redistribution (public legal pages)

**A. Realtor.com / Move Terms of Use** — https://www.realtor.com/terms-of-use/ (canonical also referenced as https://www.realtor.com/terms-of-service/) — **VERIFIED full fetch 2026-09-08**

Critical clauses for SIGNAL$:

- Access offered **solely for personal and non-commercial uses** unless otherwise specified.
- Without **express written permission of Move**, you may **not** (nor allow third parties to) modify, copy, distribute, display, scrape, publish, license, create derivative works from, frame, **use on any other Web site or application**, transfer or sell Content — including **screen scraping** / **database scraping**.
- Without express written permission, you may not access/collect/text-mine/data-mine Content by automated means or intermediaries intended to circumvent prohibitions.
- **Explicit AI ban:** “You shall not use any Content for any machine learning or artificial intelligence purposes, including … developing, building, training, fine tuning, or grounding or otherwise utilizing in any large language models (LLMs), machine learning tools, or generative AI systems.”
- Unauthorized use may subject you to **civil and/or criminal** liability under applicable law (ToS language).
- Linking restricted; home-page links only with notice rules; no framing.

**B. robots.txt** — https://www.realtor.com/robots.txt (**VERIFIED**)

- Legal notice: scraping unauthorized without express written permission from **Move Sales, Inc.**

#### What would be illegal or ToS-violating for in-product SIGNAL$ CMA

| Practice | Assessment | Tag |
|---|---|---|
| Scraping Realtor.com listings, solds, photos, or RealEstimate into SIGNAL$ | **ToS-violating**; robots.txt reinforces; civil risk | VERIFIED |
| Using Realtor.com Content to train/fine-tune/ground BidDeed LLMs or generative CMA copy | **ToS-violating** (explicit AI clause) | VERIFIED |
| Displaying scraped Realtor.com Content inside BidDeed app | **ToS-violating** (“use on any other Web site or application”) | VERIFIED |
| ListHub: charging users specifically for ListHub listing data behind paywall; resyndicating; keeping solds after drop | **Contract-violating** if publisher | VERIFIED compliance pages |
| Becoming ListHub publisher and showing **active** listings under contract + compliance | Potentially **permitted** path for **active** inventory only — still **insufficient alone** for sold-comp CMA | VERIFIED limits |

### 2.6 Recommended BidDeed path options (Realtor.com / Move) — risk notes

| Option | Fit for SIGNAL$ CMA | Risk notes |
|---|---|---|
| **A. ListHub Publisher contract** | Partial: **active** comps / photos / list prices under license | **No sold data** (CMA gap); no paywall on ListHub data; no resyndication; vetting may reject non-consumer-ad use cases; fee UNKNOWN. |
| **B. MLS direct / RESO / IDX** | Primary path for **sold + active + DOM** CMA | Not “Realtor.com” branded; required for real agent-grade CMA. |
| **C. Public records** | Sale prices / tax / deeds | Complements MLS; weak media/DOM. |
| **D. Move commercial partnership / written license** beyond ListHub | Only path to **Realtor.com-branded** estimates/history inside product | UNKNOWN willingness; start with publisher.sales + Move bizdev; expect hard “no” on scrape-equivalent. |
| **E. Lead Delivery API** | Wrong tool | Leads ≠ comps. |
| **F. Scrape Realtor.com** | **Rejected** | Explicit ToS + AI ban + robots legal notice. |

**Top recommended legal path (Realtor.com):** Treat Realtor.com **UI as non-licensable** for SIGNAL$ ingestion. For “Realtor in CMA” branding ambition, open **ListHub + Move** conversation (**Option A/D**) knowing ListHub **cannot** supply sold comps; deliver sold comps via **MLS + public records (B/C)**. Do **not** scrape. Do **not** use site Content for LLM grounding.

---

## 3. Mapping to “3 CMA tiers” (ASSUMED — Ariel has not defined tiers yet)

> **ASSUMED** tier labels below are a scoping scaffold only. Replace when Ariel locks definitions.

| Tier (ASSUMED) | Possible SIGNAL$ CMA contents | Zillow-sourced (legal) | Realtor/Move-sourced (legal) | MLS / public records |
|---|---|---|---|---|
| **Tier 1 — Snapshot** | Subject facts + 3–5 nearby solds + 1 AVM reference + market index | Research aggregate (ZHVI) **ASSUMED OK with attribution**; Zestimate **only if** Bridge approved **and** display/storage rules workable; else **omit Zillow brand** | RealEstimate **only with written license** (else omit); ListHub **cannot** supply solds | **Primary:** county sales + tax; optional MLS lite |
| **Tier 2 — Standard CMA** | Full sold+active+pending set, DOM, beds/baths/sqft, photos, adjustments narrative | Bridge Public Records (if approved) for transaction spine; **no scrape**; photos from **MLS** not Zillow scrape | ListHub **active** listings only (if publisher); solds **not** from ListHub | **Primary:** MLS RESO/IDX |
| **Tier 3 — Premium / Pro** | Tier 2 + multi-AVM panel (Zestimate + RealEstimate providers) + richer history + agent-ready PDF | Multi-AVM needs **official licenses**; legacy API ToS hostility to B2B packaging → **high approval risk** | Move written license for RealEstimate rehost **UNKNOWN**; AI clause blocks LLM-written narratives grounded on scraped Content | MLS + licensed AVMs + counsel-approved branding |

**Honesty flags:** Tier names/contents = **ASSUMED**. Field availability under contracts = **UNKNOWN** until applications return.

---

## 4. Cross-cutting recommendation for Ariel’s instruction

Ariel wants Zillow **and** Realtor in SIGNAL$ CMA across 3 tiers. **Literal scrape-based inclusion is not a lawful product path** under either company’s public Terms.

**Practical compliance reading of the instruction:**

1. **Brand/estimate panel (licensed):** Apply Bridge (Zillow) + open Move/ListHub (Realtor) conversations; budget UNKNOWN (Ariel gate >$10).  
2. **Comp engine (authoritative):** MLS + public records — shared substrate that both portals themselves largely display under **their** MLS licenses.  
3. **Labeling:** Until licenses land, SIGNAL$ can say “comps from MLS / public records” and show **market indexes** from Zillow Research (with citation), **without** claiming live Zillow/Realtor feed ingestion.  
4. **Hard no:** scraping, unofficial HTML APIs, or LLM grounding on portal Content.

---

## 5. Citation index (primary URLs touched this pass)

| URL | Role |
|---|---|
| https://www.bridgeinteractive.com/developers/zillow-group-data/ | Bridge Zillow datasets, FAQ (storage, 1k calls, spiders) |
| https://bridgedataoutput.com/docs/platform/ | Bridge platform / MLS + Zillow access model |
| https://www.zillowgroup.com/developers/terms/ | Legacy Zillow API ToS (full fetch) |
| https://www.zillow.com/corporate/terms-of-use/ | Site ToS (CAPTCHA-blocked live; indexed excerpts) |
| https://www.zillow.com/zestimate/ | Zestimate product |
| https://www.zillow.com/learn/real-estate-comps/ | Comps / Recently Sold guidance |
| https://www.zillow.com/research/data/ | Research aggregate data |
| https://www.zillow.com/mls-partners/ | Inbound MLS partnership (not outbound API) |
| https://www.realtor.com/terms-of-use/ | Move ToS (full fetch) |
| https://www.realtor.com/robots.txt | Scrape legal notice |
| https://www.realtor.com/estimates/ | RealEstimate providers |
| https://www.listhub.com/publishers/ | Publisher program + compliance |
| https://www.listhub.com/publisher-faqs/ | No sold data; photos; display flags |
| https://www.listhub.com/how-listhub-works/ | MLS/broker free basic syndication claim |
| https://support.realtor.com/s/lead-api-integration | Lead API scope |

---

## 6. Open items for Ariel (no spend yet)

1. Confirm **3 CMA tier** definitions (replace ASSUMED table).  
2. Authorize **>$10** if Bridge/ListHub sales require paid pilots (none publicly priced here).  
3. Counsel review: Bridge “no storage” vs SIGNAL$ persistence; Move AI clause vs any generative CMA copy; whether “Pro Use” language on Zillow ToS helps or hurts B2B SIGNAL$.  
4. Decide branding: licensed Zestimate/RealEstimate badges vs neutral “AVM panel” fed by separately licensed providers (CoreLogic, etc.).

---

*End of CMA_ZILLOW_REALTOR_SOURCING.md — 2026-09-08 ET — Honesty Protocol V3*
