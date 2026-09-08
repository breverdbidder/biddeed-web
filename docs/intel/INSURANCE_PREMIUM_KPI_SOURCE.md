# Insurance Premium KPI - Primary Source Brief (G3)

**Updated:** 2026-09-08 (ET)  
**Directive:** BidDeed Multi-Model Parity Grok-lane G3  
**Purpose:** Identify the same Insurance Premium (Annual) / Insurance Premium (% of value) series Reventure publishes, with primary source + licence - not scraped numbers.

---

## 1. Executive answer

| Field | Finding | Tag |
|---|---|---|
| **Primary dataset** | U.S. Treasury Federal Insurance Office (FIO) **Supporting Underlying Metrics** workbook accompanying *Analyses of U.S. Homeowners Insurance Markets, 2018-2022* | VERIFIED |
| **Underlying collection** | NAIC / state regulators **Property and Casualty Market Intelligence (PCMI) Data Call**; anonymized subset shared with FIO | VERIFIED |
| **Premium field** | **Premiums Per Policy** = Written Premium / Policies in Force (end of year); HO-3 / HO-5 multi-peril | VERIFIED |
| **Geographic grain** | **ZIP Code (5-digit), by year** (ZCTA used in report maps; public file uses ZIP Code IDs) | VERIFIED |
| **Years in primary file** | **2018-2022 only** (explicitly excludes 2023-2024) | VERIFIED |
| **Update cadence** | **One-time public ZIP release (Jan 16, 2025)** for 2018-2022; **no published recurring FIO ZIP refresh schedule** for later years | VERIFIED (release); INFERRED (no annual open series yet) |
| **Download format** | **.xlsx** (3 sheets: Disclaimer & Background; Metric Definitions; Supporting Underlying Metrics) | VERIFIED |
| **Licence / commercial reuse** | **U.S. Government work -> U.S. public domain under 17 U.S.C. sec. 105**; Treasury disclaimer is **warranty/liability**, not a redistribution ban; commercial reuse of the data **allowed**; do **not** imply Treasury endorsement or use agency marks | VERIFIED (statute + disclaimer + federal open-data policy) |
| **BidDeed in-product KPIs + Fact Finders** | **Yes - can reuse primary 2018-2022 ZIP premiums commercially** with attribution and as-is caveats | VERIFIED |
| **ZIP grain gap vs Reventure** | **None for 2018-2022** - primary is ZIP; county/state are **derived**. Gap is **post-2022 years** (Reventure scales; Treasury does not publish them) | VERIFIED |

---

## 2. Exact dataset identity

### Official names

1. **Report:** *Analyses of U.S. Homeowners Insurance Markets, 2018-2022: Climate-Related Risks and Other Factors* (Federal Insurance Office, U.S. Department of the Treasury, **January 2025**).
2. **Public data file:** *Supporting Underlying Metrics and Disclaimer for Analyses of U.S. Homeowners Insurance Markets, 2018-2022*.
3. **Collection name (upstream):** Property and Casualty Market Intelligence Data Call (**PCMI Data Call**) by the NAIC on behalf of participating states; FIO analyses use the shared subset (**PCMI Data**).

### Canonical URLs

| Asset | URL |
|---|---|
| Press release (Jan 16, 2025) + download links | https://home.treasury.gov/news/press-releases/jy2791 |
| Report PDF | https://home.treasury.gov/system/files/311/Analyses_of_US_Homeowners_Insurance_Markets_2018-2022_Climate-Related_Risks_and_Other_Factors_0.pdf |
| Supporting Underlying Metrics (.xlsx) | https://home.treasury.gov/system/files/311/Supporting_Underlying_Metrics_and_Disclaimer_for_Analyses_of_US_Homeowners_Insurance_Markets_2018-2022.xlsx |
| FIO Reports & Notices index | https://home.treasury.gov/policy-issues/financial-markets-financial-institutions-and-fiscal-service/federal-insurance-office/reports-notices |
| NAIC PCMI / homeowners data-call hub | https://content.naic.org/industry/data-call/property-ho.htm |

**Publisher:** U.S. Department of the Treasury, Federal Insurance Office (FIO), with data collected by NAIC / state insurance regulators.

### Columns in the public metrics sheet (verified from downloaded file)

`ZIP Code` | `Year` | `Policy Decile Grouping` | `Claim Frequency` | `Claim Severity` | `Loss Ratio` | **`Premiums Per Policy`** | `Nonrenewal Rate` | `Nonpayment Cancellation Rate` | `Other than Nonpayment Cancellation Rate`

Row count in downloaded workbook (header + data): **131,941** rows on the metrics sheet (about **131,940** ZIP-year observations). Sample years: **2018-2022**.

### Metric definition (premium)

From the workbook **Metric Definitions** sheet and Report Figure 2:

- **Premiums Per Policy** = Written Premium / Policies in Force at End of Reporting Year - "The average cost of a policy."
- Scope: **HO-3 and HO-5** owner-occupied multi-peril; PCMI covers about **80%** of HO-3/HO-5 direct premiums nationwide (Report / Disclaimer).

---

## 3. Geographic grain

| Level | In primary public file? | Notes |
|---|---|---|
| **ZIP (5-digit)** | **Yes - native** | One row per ZIP x year (subject to suppression). Report maps use ZCTAs for geography. |
| **County** | **No** | Must crosswalk ZIP to county (HUD/USPS or Census ZCTA-county) - **derived**, not FIO-published. |
| **State** | **No** | Derivable from ZIP; not a separate published grain in this file. |
| **National / regional** | Report aggregates only | Seven FIO analytic regions in the PDF; not a separate download grain. |

### Suppression / coverage rules (from Disclaimer sheet)

- Public file includes only ZIPs with **at least 10 reporting insurers** and **at least 50 policies**.
- These limits **reduce ZIP count by 22%** vs the PCMI Data underlying the Report; therefore **aggregate metrics in the public file will not fully match Report aggregates**.
- Residual markets, E&S, flood, and reinsurance are **out of scope**.
- Treasury did **not** validate each individual ZIP; anomalies may matter more at single-ZIP grain than in national aggregates.

---

## 4. Update cadence

| Fact | Evidence | Tag |
|---|---|---|
| Public ZIP metrics released **once** with the Jan 2025 Report for policy years **2018-2022** | Press release + Disclaimer ("does not include data from 2023 and 2024") | VERIFIED |
| FIO has **not** published a standing annual open ZIP premium series URL/schedule as of this research date | Reports & Notices lists the 2018-2022 Supporting Metrics as the data companion; no later ZIP workbook found on that index | VERIFIED (absence on FIO index) |
| NAIC / states expected PCMI to become **annual**; 2025 request expected to cover 2023-2024 | https://content.naic.org/sites/default/files/naic-response-to-rep-levin-et-al-on-pcmi.pdf | VERIFIED (NAIC expectation) |
| **2026 Homeowners Market Data Call** collects years **2018-2025**; public report targeted **early 2027** | https://content.naic.org/article/state-insurance-regulators-issue-nationwide-homeowners-market-data-call | VERIFIED |
| Whether FIO will again publish a **ZIP-level open spreadsheet** after the 2026 call | Not stated on Treasury press/report pages reviewed | **UNKNOWN** |

**Practical cadence for BidDeed:** Treat 2018-2022 FIO file as a **static vintage** until a new FIO/NAIC public ZIP release appears; monitor NAIC Homeowners Market Data Call Task Force and FIO Reports & Notices.

---

## 5. Licence / terms / redistribution

### What governs reuse

1. **17 U.S.C. sec. 105** - works of the U.S. Government are not subject to domestic copyright.  
   - https://www.govinfo.gov/content/pkg/USCODE-2023-title17/html/USCODE-2023-title17-chap1-sec105.htm
2. **Federal open-data / open-license policy** (OPEN Government Data Act summary on resources.data.gov): public agency data should have **no restrictions** on copying, publishing, distributing, transmitting, adapting, or using for **commercial or non-commercial** purposes.  
   - https://resources.data.gov/open-licenses/  
   - Legacy public-domain label: http://www.usa.gov/publicdomain/label/1.0/
3. **USA.gov guidance on government works** - do **not** imply endorsement; agency **logos/trademarks** need permission; attribution sometimes requested but U.S. gov works are not copyright-gated.  
   - https://www.usa.gov/government-copyright
4. **Treasury Fiscal Data licence analogue** (same Department; explicit commercial language): data "offered free, without restriction, and available to copy, adapt, redistribute, or otherwise use for non-commercial or commercial purposes."  
   - https://fiscaldata.treasury.gov/api-documentation/
5. **Workbook Disclaimer & Background** (terms attached to this file): Treasury releases data "to promote transparency and research"; provides quality/limitation caveats; then states metrics are **"as is" / "as available"**, disclaims warranties and liability, and says the government is **"not liable for any item created by any third party using the Supporting Underlying Metrics"**.  
   - File: https://home.treasury.gov/system/files/311/Supporting_Underlying_Metrics_and_Disclaimer_for_Analyses_of_US_Homeowners_Insurance_Markets_2018-2022.xlsx (sheet *Disclaimer & Background*).

### Commercial reuse constraints - flags

| Constraint | Severity | Action |
|---|---|---|
| Copyright block on the FIO metrics numbers | **None (US public domain)** | OK to load into KPIs / Fact Finders |
| Warranty / fitness | **Disclaimer only** | Ship with "as-is / government source" copy |
| Endorsement / logos | **Restricted** | Cite textually; do **not** use Treasury/FIO/NAIC seals as product branding |
| NAIC raw insurer microdata (non-public fields) | **Not licensed via this release** | Use **only** the public Supporting Underlying Metrics subset |
| International copyright assertion | Possible outside US (USA.gov note) | US product OK; flag if counsel needed for foreign hosting |

**Licence one-liner:** U.S. Government public-domain data (17 U.S.C. sec. 105) with Treasury as-is disclaimer - commercial reuse allowed; no endorsement/logo use; cite FIO/Treasury.

---

## 6. Reventure public description vs primary source

### What Reventure says (map tooltips)

From public map content for https://www.reventure.app/map :

**Insurance Premium Annual**  
> "The annual homeowner's insurance premium for houses in the area. Note: **2018-2022 data sourced directly from US Treasury**, **2023-2025 data uses scaling factor from BLS Homeowner's Insurance Costs PPI** to reflect insurance rate increases."  
> Source label: **U.S. Department of the Treasury**

**Insurance Premium %**  
> "The rate of homeowner insurance costs divided by the typical home value in the area. Note: **2018-2022 premium data sourced directly from US Treasury**, and [di]vided by **Zillow** values to calculate rate. **2023-2025** data uses scaling factor from **BLS Homeowner's Insurance Costs PPI**..."  
> Source label: **U.S. Department of the Treasury**

Reventure Terms also list BLS among third-party sources: https://www.reventure.app/terms-of-use-2025-12-18.pdf

### Verification against primary sources (G1 map claim)

| Claim | Primary-source check | Tag |
|---|---|---|
| HO insurance premiums from Treasury for **2018-2022** | Matches FIO Supporting Underlying Metrics **Premiums Per Policy** ZIP x year | **VERIFIED** |
| Grain is geographic area averages | ZIP-level averages (not parcel quotes) | **VERIFIED** |
| **2023-2025** also "from Treasury" | **False if read as FIO PCMI** - Disclaimer states PCMI Data **does not include 2023 and 2024**; no 2025 FIO ZIP premiums in this release | **VERIFIED contradiction** (Reventure still labels Source as Treasury while noting BLS scaling in the note) |
| **2023-2025 scaled via BLS Homeowner's Insurance Costs PPI** | Method is **Reventure's**, not published by Treasury. BLS publishes homeowners insurance **PPI** series usable for national scaling, e.g. FRED **PCU5241265241262** / **PCU9241269241262** (https://fred.stlouisfed.org/series/PCU5241265241262). BLS material is public domain with requested citation (https://www.bls.gov/opub/copyright-information.htm) | Reventure method: **VERIFIED as their stated method**; economic fidelity of ZIP-uniform PPI scale: **UNTESTED** / not a Treasury product |
| Premium **% of value** | Numerator = Treasury/FIO (or scaled) premium; denominator = **Zillow** home values per Reventure - **hybrid**, not a FIO field | **VERIFIED** (Reventure description) |

**Bottom line:** Reventure's **2018-2022** layer is the FIO/PCMI public ZIP premium series. Their **2023-2025** layer is **modeled** (national BLS PPI scale), not a Treasury ZIP series.

---

## 7. Recommendation for BidDeed

### Can we use the primary series legally for in-product KPIs and Fact Finders?

**Yes - VERIFIED** for the **2018-2022 FIO Supporting Underlying Metrics**, including commercial SaaS display, aggregation to county/metro/state, charts, and Fact Finder narratives, provided:

1. **Attribution** (recommended / best practice; also matches BLS ask if PPI used):  
   "U.S. Department of the Treasury, Federal Insurance Office - Supporting Underlying Metrics for *Analyses of U.S. Homeowners Insurance Markets, 2018-2022* (PCMI Data via NAIC / state regulators)."
2. **As-is caveat** echoing Treasury disclaimer (ZIP anomalies; not validated per ZIP; HO-3/HO-5; suppression; no residual/E&S/flood).
3. **No Treasury/FIO endorsement** language or seals.
4. Use the **official .xlsx**, not a scraped Reventure value (Reventure's post-2022 figures are **not** primary).

### Attribution required?

- **Copyright licence condition:** None under sec. 105 for the U.S. government metrics file.
- **Product / trust requirement:** **Yes, cite the source** (and year vintage).
- **If using BLS PPI for any extension:** Cite Bureau of Labor Statistics (BLS copyright page requests citation; data still public domain).

### Gaps vs ZIP grain / product parity

| Need | Status |
|---|---|
| ZIP premiums 2018-2022 | **Available** in primary file |
| County / state rollups | **Derived** (crosswalk); document methodology |
| ZIP premiums **2023-2025** | **Not in Treasury file** - wait for next public release **or** document BidDeed-owned scale (e.g. BLS PPI) as **MODELED**, never as "Treasury" |
| Premium **% of home value** | Needs a **home-value denominator** under BidDeed's own licences (Zillow/other) - separate from FIO |
| Full national ZIP coverage | **About 22% of ZIPs suppressed** in public file; Fact Finders should show "insufficient insurer/policy count" not invent fills |
| Ongoing refresh | **UNKNOWN** until FIO/NAIC publish next open ZIP extract (NAIC public report eyed early 2027) |

### Suggested BidDeed KPI wiring

1. **Insurance Premium (Annual)** = FIO `Premiums Per Policy` for selected geography/year (latest official year **2022** until refresh).
2. **Insurance Premium (% of value)** = (1) / BidDeed-approved value series - **label both sources**.
3. Optional **MODELED current** overlay: apply BLS homeowners PPI growth from 2022 to present **only** if product clearly tags **MODELED / not Treasury**.
4. Prefer **not** to scrape or reverse-engineer Reventure's scaled layer.

---

## 8. Source appendix (every factual claim)

| Claim area | URL |
|---|---|
| FIO press + data announcement | https://home.treasury.gov/news/press-releases/jy2791 |
| FIO report PDF | https://home.treasury.gov/system/files/311/Analyses_of_US_Homeowners_Insurance_Markets_2018-2022_Climate-Related_Risks_and_Other_Factors_0.pdf |
| Supporting Underlying Metrics .xlsx | https://home.treasury.gov/system/files/311/Supporting_Underlying_Metrics_and_Disclaimer_for_Analyses_of_US_Homeowners_Insurance_Markets_2018-2022.xlsx |
| FIO Reports & Notices | https://home.treasury.gov/policy-issues/financial-markets-financial-institutions-and-fiscal-service/federal-insurance-office/reports-notices |
| NAIC homeowners / PCMI data call | https://content.naic.org/industry/data-call/property-ho.htm |
| NAIC 2026 call announcement | https://content.naic.org/article/state-insurance-regulators-issue-nationwide-homeowners-market-data-call |
| NAIC PCMI future-years expectations | https://content.naic.org/sites/default/files/naic-response-to-rep-levin-et-al-on-pcmi.pdf |
| 17 U.S.C. sec. 105 | https://www.govinfo.gov/content/pkg/USCODE-2023-title17/html/USCODE-2023-title17-chap1-sec105.htm |
| Open licenses / public domain | https://resources.data.gov/open-licenses/ |
| USA.gov government copyright | https://www.usa.gov/government-copyright |
| Treasury Fiscal Data commercial reuse language | https://fiscaldata.treasury.gov/api-documentation/ |
| BLS copyright / public domain | https://www.bls.gov/opub/copyright-information.htm |
| BLS PPI homeowners series (example) | https://fred.stlouisfed.org/series/PCU5241265241262 |
| Reventure map | https://www.reventure.app/map |
| Reventure terms (third-party sources) | https://www.reventure.app/terms-of-use-2025-12-18.pdf |
| Independent methodology mirroring FIO ZIP premiums | https://plaininsure.com/methodology |

---

*End of INSURANCE_PREMIUM_KPI_SOURCE.md - 2026-09-08 (ET)*
