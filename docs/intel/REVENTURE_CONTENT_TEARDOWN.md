# Reventure Content & Positioning Teardown

**Lane:** BidDeed.AI Grok competitive intel (Multi-Model Parity Directive G1)  
**Subject:** Reventure App / Reventure Consulting / Reventure Housing Reports  
**Research date:** 2026-09-08 (America/New_York)  
**Honesty Protocol V3:** Claims tagged **VERIFIED** (live public source), **INFERRED** (reasonable synthesis), or **UNKNOWN** (not publicly confirmed).  
**Scope limits:** Public pages only. No signup, payment, or ToS acceptance beyond reading public content. Numbers not invented; incomplete counts marked UNKNOWN/INFERRED.

---

## 1. Executive summary

Reventure positions as a **macro-to-ZIP housing market analytics + forecast product**, not a distressed-asset, foreclosure, or auction workflow tool.

| Dimension | Reventure (public positioning) | Distressed / auction wedge (BidDeed contrast) |
|---|---|---|
| Primary buyer persona | Homebuyers + buy-and-hold / flip / rental investors timing *markets* | Operators sourcing *specific distressed assets* (NOD, auction, REO, short sale) |
| Core job-to-be-done | “Is this ZIP / metro going up or down over 12 months?” + affordability / overvaluation | “Which parcels are in distress *now*, at what stage, with what economics?” |
| Data spine | Aggregated indices (Zillow ZHVI/ZORI, Realtor.com listings, Census, BLS/FRED, Redfin sales) | Transaction / legal / auction-event pipelines |
| Hero metric | Home Price Forecast (1-year) + Overvalued % | Foreclosure filing, auction date, opening bid, equity, lien stack |
| Distribution | High-volume YouTube (crash / inventory / migration hooks) → app upgrade | (Contrast only — not covered here) |

**VERIFIED positioning statements**

- Homepage / schema: “#1 Housing Market Data tool” for historical trends and **home price forecasts by ZIP**; free plan = **8 core data points**; paid = **40+ premium data points**, forecasts for **30,000 ZIPs**, downloadable reports. ([https://www.reventure.app/](https://www.reventure.app/))
- About: real-time data on home prices, inventory, seller price cuts, overvaluation; updated monthly for **50 states, ~500 metros, ~3,000 counties, ~30,000 ZIPs**. ([https://www.reventure.app/about-us](https://www.reventure.app/about-us))
- Sources named publicly: Zillow, Realtor.com, US Census Bureau, Bureau of Labor Statistics (and map tooltips also cite Redfin, FRED, US Treasury, Harvard Dataverse, NCEI). ([https://www.reventure.app/](https://www.reventure.app/), [https://www.reventure.app/map](https://www.reventure.app/map))
- Content engine: founder Nick Gerli’s YouTube (**@ReventureConsulting**) drives demand into the app; secondary channel **Reventure Housing Reports** (**@ReventureReports**) publishes metro “correction / supply shock” reports. ([https://www.youtube.com/@ReventureConsulting](https://www.youtube.com/@ReventureConsulting), [https://www.youtube.com/@ReventureReports](https://www.youtube.com/@ReventureReports), [https://www.reventure.app/about-us](https://www.reventure.app/about-us))

**Strategic takeaway (INFERRED):** Reventure owns the *narrative market timing* layer (inventory, DOM, price cuts → 12-month forecast). It **talks about** foreclosures and short sales in content when they reinforce the crash story, but the **product surface** remains index/listing/demo metrics—not parcel-level distress or auction ops. That gap is the BidDeed wedge.

---

## 2. Metric catalogue

### 2.1 How Reventure markets the KPI set

| Claim | Tag | Source |
|---|---|---|
| Free: **8** data points (examples named: home value growth trends, inventory, population, median income, rental rates) | VERIFIED (count + partial list) | [https://www.reventure.app/](https://www.reventure.app/) |
| Premium: **40+** data points | VERIFIED (marketing claim) | [https://www.reventure.app/](https://www.reventure.app/), [https://www.reventure.app/pricing](https://www.reventure.app/pricing) |
| Exact free vs paid assignment for every map metric | **UNKNOWN** | Requires logged-in / paid session (not done) |
| Directive parity target “~77 metrics” | Context only | Internal G1; Reventure’s *public* catalogue below is what was found live |

**Catalogue count found on public map definitions:** **69** named metrics with public formula/description text on [https://www.reventure.app/map](https://www.reventure.app/map), **plus 3** proprietary scores named on pricing / third-party writeups (**Home Price Forecast / Forecast Score**, **Long-Term Growth Score**, **Investor Score**) = **72 named KPI surfaces**.  
Whether the in-app UI exposes additional paywalled-only fields beyond these: **UNKNOWN**.

**Free vs paid (honest):**

- **VERIFIED free (named):** “8 Data Points” including Home Value Growth Trends, Inventory Levels, Population, Median Income, Rental Rates. ([https://www.reventure.app/](https://www.reventure.app/)) Blog also states home value, inventory, and demographic data for most ZIPs available free; Forecast and Valuation Rates are premium. ([https://reventureapp.blog/reventures-2025-us-housing-market-forecast/](https://reventureapp.blog/reventures-2025-us-housing-market-forecast/))
- **VERIFIED premium (named):** Home Price Forecast / Forecast Score; Long-Term Growth and Investor Scores; Listing Analyser; 5 downloadable market reports/month; sortable rankings; “40+” points. ([https://www.reventure.app/pricing](https://www.reventure.app/pricing))
- For each row below: Free/Paid = **UNKNOWN** unless noted; do not assume map visibility = free access.

### 2.2 Home Price & Affordability (map)

| # | Metric | Stated formula / definition (public) | Free/Paid | Tag |
|---|---|---|---|---|
| 1 | Home Value | Typical home value via Zillow Home Value Index (ZHVI), smoothed, seasonally adjusted | UNKNOWN | VERIFIED def. |
| 2 | Home Value Growth (YoY) | YoY % change in ZHVI | UNKNOWN (named in free examples as “growth trends”) | VERIFIED |
| 3 | Home Value Growth (5-Year) | 5-year growth in home values (ZHVI) | UNKNOWN | VERIFIED |
| 4 | Home Value Growth (MoM) | Seasonally adjusted MoM ZHVI growth | UNKNOWN | VERIFIED |
| 5 | Overvalued % | Current Home Value/Income Ratio vs long-term average; not a price forecast | Premium-leaning (blog: Valuation Rates premium) | VERIFIED def.; Free/Paid INFERRED premium |
| 6 | Home Value / Income Ratio | Typical Home Value ÷ Median Household Income | UNKNOWN | VERIFIED |
| 7 | Single Family Value | ZHVI for SFR | UNKNOWN | VERIFIED |
| 8 | Single Family Value Growth (YoY) | YoY ZHVI SFR | UNKNOWN | VERIFIED |
| 9 | Condo Value | ZHVI condo (may be N/A) | UNKNOWN | VERIFIED |
| 10 | Condo Value Growth (YoY) | YoY ZHVI condo | UNKNOWN | VERIFIED |
| 11 | Mortgage Payment | Est. payment incl. interest, taxes, insurance from values + rates | UNKNOWN | VERIFIED |
| 12 | Mtg Payment as % of Income | Annual house payment ÷ median household income | UNKNOWN | VERIFIED |
| 13 | Salary to Afford a House | Income needed assuming 30% of gross on PITI | UNKNOWN | VERIFIED |
| 14 | Property Tax Annual | Est. annual tax at typical home value | UNKNOWN | VERIFIED |
| 15 | Property Tax Rate | Tax as % of typical home value | UNKNOWN | VERIFIED |
| 16 | Insurance Premium Annual | HO insurance; 2018–22 Treasury, 2023–25 scaled via BLS PPI | UNKNOWN | VERIFIED |
| 17 | Insurance Premium % | Insurance ÷ typical home value | UNKNOWN | VERIFIED |
| 18 | Buy v Rent Differential | Mortgage payment cost vs renting; higher % = buy more expensive vs rent | UNKNOWN | VERIFIED |
| 19 | % Change from 2022 Peak | % change in home value from June 2022 peak | UNKNOWN | VERIFIED |
| 20 | % Crash from 2007–12 | ZHVI decline 2007–2012 | UNKNOWN | VERIFIED |

Source for rows 1–20: [https://www.reventure.app/map](https://www.reventure.app/map)

### 2.3 Market Trends (map)

| # | Metric | Stated formula / definition | Free/Paid | Tag |
|---|---|---|---|---|
| 21 | For Sale Inventory | Active listings (excl. pending), Realtor.com | Likely free-ish (inventory named in free 8) | VERIFIED def. |
| 22 | Sale Inventory Growth (YoY) | YoY growth in for-sale inventory | UNKNOWN | VERIFIED |
| 23 | Sale Inventory Growth (MoM) | MoM inventory growth (seasonal) | UNKNOWN | VERIFIED |
| 24 | Inventory Surplus/Deficit | Recent month inventory vs long-term average for that month | UNKNOWN | VERIFIED |
| 25 | Inventory as % of Houses | For-sale homes ÷ owned homes | UNKNOWN | VERIFIED |
| 26 | Home Sales | Homes sold/month (Redfin; 3-mo trailing avg at ZIP) | UNKNOWN | VERIFIED |
| 27 | Home Sales Growth (YoY) | YoY home sales (Redfin) | UNKNOWN | VERIFIED |
| 28 | Home Sales Surplus/Deficit | Recent sales vs long-term monthly norm | UNKNOWN | VERIFIED |
| 29 | Price Cut % | % of listings with a price reduction (Realtor.com) | UNKNOWN | VERIFIED |
| 30 | Days on Market | Median DOM until sell/delist (Realtor.com) | UNKNOWN | VERIFIED |
| 31 | Days on Market Growth (YoY) | YoY DOM growth | UNKNOWN | VERIFIED |
| 32 | Median Listing Price | Median list price, latest month (Realtor.com) | UNKNOWN | VERIFIED |
| 33 | Median Listing Price (YoY) | YoY median list price | UNKNOWN | VERIFIED |
| 34 | New Listing Count | New seller listings in month (Realtor.com) | UNKNOWN | VERIFIED |
| 35 | New Listing Count (YoY) | YoY new listings | UNKNOWN | VERIFIED |

Source: [https://www.reventure.app/map](https://www.reventure.app/map)

### 2.4 Demographic (map)

| # | Metric | Stated formula / definition | Free/Paid | Tag |
|---|---|---|---|---|
| 36 | Population | ACS latest year | Named in free 8 | VERIFIED |
| 37 | Population Growth | 5-year ACS population growth | UNKNOWN | VERIFIED |
| 38 | Median Household Income | ACS median HH income | Named in free 8 | VERIFIED |
| 39 | Income Growth | 5-year median income growth | UNKNOWN | VERIFIED |
| 40 | Population Density (/sq mi) | Residents per sq mi | UNKNOWN | VERIFIED |
| 41 | Weather (Avg Temperature) | Avg year-round temp (NCEI county) | UNKNOWN | VERIFIED |
| 42 | Remote Work % | % employees WFH (ACS) | UNKNOWN | VERIFIED |
| 43 | College Degree Rate | % age 25+ with bachelor’s+ | UNKNOWN | VERIFIED |
| 44 | Homeownership Rate | % HH that own | UNKNOWN | VERIFIED |
| 45 | Homeowners 25–44 % | Share of homeowners 25–44 | UNKNOWN | VERIFIED |
| 46 | Homeowners 75+ % | Share of homeowners 75+ | UNKNOWN | VERIFIED |
| 47 | Mortgaged Home % | % owner HH with a mortgage | UNKNOWN | VERIFIED |
| 48 | Median Age | ACS median age | UNKNOWN | VERIFIED |
| 49 | Poverty Rate | % HH below poverty line | UNKNOWN | VERIFIED |
| 50 | Family Households % | % family HH | UNKNOWN | VERIFIED |
| 51 | Single Households % | % single HH | UNKNOWN | VERIFIED |
| 52 | Housing Units | ACS housing unit count | UNKNOWN | VERIFIED |
| 53 | Housing Unit Growth Rate | 5-year housing unit growth | UNKNOWN | VERIFIED |
| 54 | Birth / Death Ratio | Births relative to deaths (Reventure calc on Census) | UNKNOWN | VERIFIED |
| 55 | Vote Republican % | % Republican in last 7 presidential elections (thru 2024) | UNKNOWN | VERIFIED |
| 56 | Vote Democrat % | % Democrat, same series | UNKNOWN | VERIFIED |

Source: [https://www.reventure.app/map](https://www.reventure.app/map)

### 2.5 Investor Metrics (map)

| # | Metric | Stated formula / definition | Free/Paid | Tag |
|---|---|---|---|---|
| 57 | Rental Rate | ZORI typical monthly rent (metro); county/ZIP estimated vs Census rents | Named in free 8 | VERIFIED |
| 58 | Rent For Houses | ZORI × 1.25 for larger units | UNKNOWN | VERIFIED |
| 59 | Rent Growth (YoY) | YoY ZORI (metro/county only noted) | UNKNOWN | VERIFIED |
| 60 | Rent as % of Income | Annual rent ÷ median HH income | UNKNOWN | VERIFIED |
| 61 | Home Value to Rent Ratio | Home value ÷ annual rent for houses | UNKNOWN | VERIFIED |
| 62 | Overvalued % – Rental Market | Home values vs fair value from long-term HV/rent ratio | INFERRED premium (valuation) | VERIFIED def. |
| 63 | Cap Rate | Unlevered return at prevailing values & rents (estimate; ZIP error risk noted) | UNKNOWN | VERIFIED |
| 64 | Vacancy Rate | Vacant units ÷ total units | UNKNOWN | VERIFIED |
| 65 | Building Permits | 12-month sum of permits (Census) | UNKNOWN | VERIFIED |
| 66 | Building Permits % | 12-mo permits ÷ housing stock (ACS lagged; recent years projected) | UNKNOWN | VERIFIED |
| 67 | Domestic Migration | Net domestic migration (state/metro/county only) | UNKNOWN | VERIFIED |
| 68 | Domestic Migration % | Domestic migration ÷ population | UNKNOWN | VERIFIED |
| 69 | Shadow Inventory % | Share of owned houses seasonally vacant and/or absentee-owned | UNKNOWN | VERIFIED |

Source: [https://www.reventure.app/map](https://www.reventure.app/map)

### 2.6 Reventure Scores (proprietary)

| # | Metric | Stated formula / definition | Free/Paid | Tag |
|---|---|---|---|---|
| 70 | Home Price Forecast (1-Year) / Forecast Score | Inputs: inventory, price cuts, DOM, mortgage rates, recent value trends → 0–100 score converted to % 12-mo forecast. Below 50 ≈ declining; above 50 ≈ growing. Claims 66% correlation (Feb 2025→2026, top ~380 metros) and “4x better than Zillow” for that window. | **Premium** (VERIFIED) | VERIFIED |
| 71 | Long-Term Growth Score | Ranked for every market (pricing page). Third-party: ~5–10 year appreciation from fundamentals (demographics, income, economy). Exact formula **not** published on Reventure pages fetched. | Premium (pricing) | VERIFIED existence; formula UNKNOWN |
| 72 | Investor Score | Ranked for every market (pricing page). Exact formula **UNKNOWN** on public pages fetched. | Premium (pricing) | VERIFIED existence; formula UNKNOWN |

Sources: [https://www.reventure.app/forecast](https://www.reventure.app/forecast), [https://www.reventure.app/pricing](https://www.reventure.app/pricing), [https://reventureapp.blog/reventures-2025-us-housing-market-forecast/](https://reventureapp.blog/reventures-2025-us-housing-market-forecast/), [https://retipster.com/spot-overvalued-markets/](https://retipster.com/spot-overvalued-markets/)

### 2.7 Explicitly *not* found as first-class product metrics (vs BidDeed)

Public map / pricing / forecast pages reviewed do **not** publish first-class KPIs for: foreclosure filing counts by ZIP as a scored product metric, auction calendars, opening bids, trustee/sale type, NOD→auction conversion, REO status, lien priority, or bid-to-value. Foreclosures appear as **content risk narrative** and occasional third-party stats in videos/blog, not as catalogue rows on the map. ([https://www.reventure.app/map](https://www.reventure.app/map), [https://reventureapp.blog/reventures-2025-us-housing-market-forecast/](https://reventureapp.blog/reventures-2025-us-housing-market-forecast/))

**Parity note:** Public catalogue ≈ **72** named surfaces vs G1 ~77 target → **near parity on breadth of *market* KPIs**, but **orthogonal** to distressed/auction KPI space.

---

## 3. Content cadence & hooks

### 3.1 Channel stats (live about-page / third-party)

| Channel | Handle | Subscribers | Lifetime views | Joined | Videos (3P) |
|---|---|---|---|---|---|
| Reventure Consulting | [@ReventureConsulting](https://www.youtube.com/@ReventureConsulting) | **683K** VERIFIED | **224,178,725** VERIFIED | Jul 19, 2020 VERIFIED | **1,437** (AskNaveen, updated ~2026-09-07) |
| Reventure Housing Reports | [@ReventureReports](https://www.youtube.com/@ReventureReports) (display: Reventure Housing Reports) | **20.2K** VERIFIED | **2,435,543** VERIFIED | Sep 20, 2023 VERIFIED | UNKNOWN total (RSS shows long-form metro reports) |

Sources: YouTube about HTML for each handle; [https://asknaveen.com/channel/@reventureconsulting](https://asknaveen.com/channel/@reventureconsulting).  
Marketing site claims “1M+ Total Subscribers / 200M+ Views” across presence — **INFERRED** as multi-platform / rounded brand claim vs YouTube-only 683K. ([https://reventureconsulting.com/](https://reventureconsulting.com/))

AskNaveen also reports ~**3.4M views / 28 days** and ~**+2K subs / 28 days** for Consulting — treat as third-party snapshot, not YouTube API. ([https://asknaveen.com/channel/@reventureconsulting](https://asknaveen.com/channel/@reventureconsulting))

### 3.2 Posting rhythm

**@ReventureConsulting (RSS sample, 15 most recent as of 2026-09-08):**

- Mix of **Shorts** (city walk-and-talk / loss anecdotes) and **long-form** (~10–17 min).
- Gaps between consecutive publishes: median **~0.9 days**, mean **~0.8 days** → effectively **daily / near-daily**.  
  Feed: [https://www.youtube.com/feeds/videos.xml?channel_id=UCVTQunGrE3p7Oq8Owao5y_Q](https://www.youtube.com/feeds/videos.xml?channel_id=UCVTQunGrE3p7Oq8Owao5y_Q)

Recent titles (hooks): Seattle supply skyrockets; Portland down 20%; D.R. Horton cancellations; Florida builder pipeline / foreclosures spike 300%; Home Depot CFO alarm; “last affordable big city” correcting.

**@ReventureReports (RSS sample, 15 entries):**

- Long-form metro “full-scale correction / supply shock / 2026 forecast” template.
- Gaps: median **~9.9 days**, mean **~14.9 days** historically; **latest RSS entry 2026-02-25** (Orlando) → cadence may have slowed or paused after Feb 2026 (**INFERRED** from feed only).  
  Feed: [https://www.youtube.com/feeds/videos.xml?channel_id=UC85rmO0-XQIjTqL3vl1WwHg](https://www.youtube.com/feeds/videos.xml?channel_id=UC85rmO0-XQIjTqL3vl1WwHg)

**Blog (Reventure News):** High Florida / unaffordability / inventory / baby-bust cadence; homepage lists many ~7–10 min reads with crash/inventory hooks. Exact posts/week not counted exhaustively → **UNKNOWN** precise blog RPM. ([https://reventureapp.blog/](https://reventureapp.blog/))

### 3.3 Hook patterns (VERIFIED from titles + descriptions)

1. **Crash / stage framing:** “2nd stage of the Housing Crash,” “full-scale correction,” “deflation vortex.”
2. **Loss dollarization:** “$130,000 loss,” “$115,000 losses,” short-sale anecdotes.
3. **Authority coattails:** “Redfin confirms,” “NY Times issues Recession WARNING,” “Home Depot CFO,” “D.R. Horton.”
4. **Fear + FOMO for buyers:** “Get out before it’s too late” *and* “now is when buyers get leverage / use forecast to negotiate.”
5. **Geo specificity:** Florida, Texas (Dallas/Austin/Houston), Atlanta, Seattle, Portland, Orlando, Tampa.
6. **CTA every video:** unlock ZIP forecast / overvalued % on reventure.app / mobile apps.

### 3.4 Engagement proxies (view counts VERIFIED via watch-page `viewCount`; comment ratios mostly UNKNOWN)

| Video | Channel | Views (VERIFIED) | Likes (approx.) | Published | Notes |
|---|---|---|---|---|---|
| [The 2nd stage of the Housing Crash…](https://www.youtube.com/watch?v=es7onAz1mn8) | Consulting | **346,105** | ~7.2K | 2025-06-14 | High views; inventory/overvaluation screen-share |
| [A.P. News MASS layoff…](https://asknaveen.com/channel/@reventureconsulting) (listed) | Consulting | **249.4K** (3P) | 5.6K (3P) | 2026-08-17 | AskNaveen trending list |
| [Florida's about to implode…](https://asknaveen.com/channel/@reventureconsulting) | Consulting | **250.9K** (3P) | 5.3K (3P) | 2025-12-28 | 3P |
| [Get out before it's too late…](https://www.youtube.com/watch?v=ImJJ1_mf0k8) | Consulting | **205,202** | ~6.4K | 2026-01-03 | Builder warning + poll CTA |
| [People have stopped paying their mortgage](https://www.youtube.com/watch?v=p2y_pwUXTvU) | Consulting | **200,983** | ~3.6K | 2026-04-17 | Foreclosure/short-sale narrative |
| [Save your money (18-year cycle…)](https://www.youtube.com/watch?v=Bc78p8OrhRk) | Consulting | **194,118** | likes parse unreliable | 2025-10-20 | Cycle + foreclosure-moratorium theme |
| [A deflation vortex…](https://www.youtube.com/watch?v=n0k85KYVMt8) | Consulting | **130,546** | ~4K | 2026-02-10 | Houston investor exits |
| [Redfin confirms shocking truth…](https://www.youtube.com/watch?v=c1hHs4xjNYA) | Consulting | **114,149** | UNKNOWN | 2025-10-24 | Local crash proof (Punta Gorda) |
| [$130,000 loss on houses in Florida](https://www.youtube.com/watch?v=zI-3w88jyPw) | Consulting | **31,491** | 892 | 2026-03-18 | Short; lower absolute views |
| [Atlanta full-scale correction…](https://www.youtube.com/watch?v=vwCIGsR2nfU) | Reports | **45,733** | 948 | 2025-12-12 | Strong for 20.2K-sub channel |
| [Orlando full-scale correction…](https://www.youtube.com/watch?v=y6ruZ3Qxs04) | Reports | **19,242** | 562 | 2026-02-25 | RSS + watch page |
| [Top 10 States Highest Migration](https://www.youtube.com/watch?v=DI76FAGoycQ) | Reports | **7,913** | 302 | 2024-11-18 | Short listicle |

**Engagement pattern (INFERRED):** Long-form **national crash / foreclosure / builder-warning** titles drive 100K–300K+ views on Consulting. **Short loss vignettes** can underperform on absolute views vs long-form. Reports metro deep-dives punch above sub count when titled “full-scale correction (2026 supply shock).”  
**View/comment ratio:** comment counts not systematically captured → **UNKNOWN** as a reliable ranking metric in this pass.

---

## 4. Pricing ladder

| Tier / SKU | Price | What’s included (public) | Honesty |
|---|---|---|---|
| Free Plan | **$0** | 8 core data points; account required for map (per competitor comparison + homepage). No credit card. | **VERIFIED** price & “8 points” — [https://www.reventure.app/](https://www.reventure.app/) schema Product “Reventure Free Plan” |
| Monthly Pass / Premium Monthly | **$39/mo** (web pricing page schema & copy) | Listing Analyser; 40+ points; 12-mo forecasts (30k ZIPs); Long-Term Growth & Investor Scores; inventory/price cut/DOM; ~20y history; iOS/Android; **5 reports/mo**; sortable rankings | **VERIFIED** — [https://www.reventure.app/pricing](https://www.reventure.app/pricing) |
| Annual Pass | **$399/yr** (~**$33/mo**, “save 15%/32%” messaging varies by page) | Same premium feature set; billed annually | **VERIFIED** — pricing page |
| App Store IAP: Premium Monthly | **$39.00** and also listed **$49.00** | Same premium family (store listing) | **VERIFIED** both SKUs listed — [https://apps.apple.com/us/app/reventure-app/id6736954854](https://apps.apple.com/us/app/reventure-app/id6736954854). Why two monthly prices coexist: **UNKNOWN** (legacy vs promo vs geo) |
| App Store IAP: Premium Yearly | **$399.00** | Annual | **VERIFIED** — App Store |
| App Store: Memorial Day Sale | **$239.00** | Promotional annual-like SKU (details of entitlement **UNKNOWN** without purchase) | **VERIFIED** listed — App Store |
| Homepage schema Product “Monthly Pass” | **$49.00** in JSON-LD (conflicts with live /pricing $39) | “40+ points… 5 reports… $49/month” | **VERIFIED** schema text on homepage HTML; treat as **stale/alternate** vs current pricing page — flag inconsistency |
| Blog CTAs | Sometimes still say **$49/mo** | e.g. national data post | **VERIFIED** copy lag — [https://reventureapp.blog/introducing-national-housing-market-data-on-reventure-app/](https://reventureapp.blog/introducing-national-housing-market-data-on-reventure-app/) |
| **$19/mo State Level Access** | — | Sought across pricing, homepage, App Store, Play, blog, web search | **UNKNOWN — not found on any public page in this research.** Not VERIFIED. Do not treat as live. |
| YouTube Channel Membership | UNKNOWN $ | “priority during livestream chats” | Existence of join link VERIFIED in video descriptions; price UNKNOWN |

**Conclusion on $19 tier:** **Not VERIFIED.** Exhaustive public search + pricing/App Store/Play fetches found **no** “State Level Access” / “$19/mo” offer as of 2026-09-08. Could be retired, gated, affiliate-only, or never shipped — status remains **UNKNOWN**.

---

## 5. Narrative weaknesses vs distressed-asset / foreclosure-auction dataset (BidDeed wedge)

1. **Index ≠ parcel.** ZHVI / ZORI / Realtor.com inventory answer “how is the *market*?” They do not answer “which *address* is in NOD, scheduled for sale, or REO tomorrow?” Reventure’s own map definitions never list foreclosure/auction fields. ([https://www.reventure.app/map](https://www.reventure.app/map))

2. **Foreclosure is a content prop, not a product.** Blog cites Ice Mortgage Monitor / delinquency as *forecast risk*; videos cite Attom-style foreclosure filing growth and Zillow “short sale” keyword hunting. That proves audience hunger for distress — and that Reventure monetizes it via **forecast upsell**, not distress workflow. ([https://reventureapp.blog/reventures-2025-us-housing-market-forecast/](https://reventureapp.blog/reventures-2025-us-housing-market-forecast/), [https://www.youtube.com/watch?v=p2y_pwUXTvU](https://www.youtube.com/watch?v=p2y_pwUXTvU))

3. **“Shadow Inventory %” is not legal shadow inventory.** Public definition = seasonally vacant / absentee-owned share — vacation/2nd-home volatility — **not** delinquent pre-foreclosure pipeline. Easy to confuse operators; BidDeed can own true pipeline clarity. ([https://www.reventure.app/map](https://www.reventure.app/map))

4. **Monthly cadence vs event-time.** Developer replies: market trends ~every 30 days, home values mid-month. Auction/NOD markets move on **daily dockets**. Latency is a structural mismatch for bidding desks. ([https://play.google.com/store/apps/details?id=com.reventure.mobileapp&hl=en_US](https://play.google.com/store/apps/details?id=com.reventure.mobileapp&hl=en_US))

5. **Buyer/investor timing narrative leaves the “how do I buy the distress?” unfinished.** CTAs resolve to ZIP forecast + overvalued %. No public auction calendar, bid strategy, title/lien, or deposit workflow. Content creates urgency; product cannot close the distressed loop. (Pricing + forecast + video CTAs)

6. **Accuracy caveats they publish themselves.** Forecast weaker at small ZIPs / low population; weaker pre-pandemic undervalued regimes; they’re “working on” dynamic undervaluation adjustment. Distressed buyers need *deal-level* truth more than metro R². ([https://www.reventure.app/forecast](https://www.reventure.app/forecast))

7. **Pricing confusion / premium wall.** Free = 8 points behind account; Forecast gated at $39/$399. Competing comparison sites note no advertised trial on pricing page (third-party). Distressed pros may reject paying for *another* market dashboard that doesn’t list auctions. ([https://www.reventure.app/pricing](https://www.reventure.app/pricing), [https://www.havenscore.app/vs/reventure](https://www.havenscore.app/vs/reventure) — competitor page; use cautiously)

8. **Geo coverage marketing vs distress hotspots.** Strong FL/TX/Atlanta content aligns with correction markets — BidDeed can meet the same audience with **actionable** lists where Reventure only shows inventory surplus and −X% forecasts.

---

## 6. Source appendix (URLs for factual claims)

### Product & pricing
- https://www.reventure.app/
- https://www.reventure.app/pricing
- https://www.reventure.app/map
- https://www.reventure.app/forecast
- https://www.reventure.app/about-us
- https://www.reventure.app/terms-of-use-2025-12-18.pdf
- https://apps.apple.com/us/app/reventure-app/id6736954854
- https://play.google.com/store/apps/details?id=com.reventure.mobileapp&hl=en_US
- https://reventureconsulting.com/

### Blog / content
- https://reventureapp.blog/
- https://reventureapp.blog/reventures-2025-us-housing-market-forecast/
- https://reventureapp.blog/introducing-national-housing-market-data-on-reventure-app/

### YouTube
- https://www.youtube.com/@ReventureConsulting
- https://www.youtube.com/@ReventureReports
- https://www.youtube.com/channel/UCVTQunGrE3p7Oq8Owao5y_Q
- https://www.youtube.com/channel/UC85rmO0-XQIjTqL3vl1WwHg
- https://www.youtube.com/feeds/videos.xml?channel_id=UCVTQunGrE3p7Oq8Owao5y_Q
- https://www.youtube.com/feeds/videos.xml?channel_id=UC85rmO0-XQIjTqL3vl1WwHg
- https://www.youtube.com/watch?v=es7onAz1mn8
- https://www.youtube.com/watch?v=ImJJ1_mf0k8
- https://www.youtube.com/watch?v=p2y_pwUXTvU
- https://www.youtube.com/watch?v=Bc78p8OrhRk
- https://www.youtube.com/watch?v=n0k85KYVMt8
- https://www.youtube.com/watch?v=c1hHs4xjNYA
- https://www.youtube.com/watch?v=zI-3w88jyPw
- https://www.youtube.com/watch?v=vwCIGsR2nfU
- https://www.youtube.com/watch?v=y6ruZ3Qxs04
- https://www.youtube.com/watch?v=DI76FAGoycQ
- https://www.youtube.com/shorts/AcdXl_gPHy8 (Seattle short, RSS 2026-09-07)

### Third-party stats / comparisons (secondary)
- https://asknaveen.com/channel/@reventureconsulting
- https://retipster.com/spot-overvalued-markets/
- https://www.havenscore.app/vs/reventure (competitor comparison; browser-walled on fetch)

### Social
- https://x.com/nickgerli1 (linked from org schema)

---

## Research notes

- No account created; paywalled metric matrix and Listing Analyser internals not inspected.
- Homepage JSON-LD still advertising $49 Monthly Pass while `/pricing` schema shows $39 — document both.
- `$19/mo State Level Access`: **not located**; remains UNKNOWN pending insider/screenshot/paywall evidence.
- Metric count **72** = 69 map definitions + 3 scores; not a claim that Reventure’s internal warehouse has exactly 72 fields.
