# G3 STATUS - Insurance Premium KPI Source Research

**File:** `docs/intel/INSURANCE_PREMIUM_KPI_SOURCE.md`  
**Updated:** 2026-09-08 (ET)  
**Directive:** BidDeed Multi-Model Parity Grok-lane G3  
**Honesty Protocol V3**

## Honesty summary

| Item | Tag | Notes |
|---|---|---|
| Primary source = Treasury FIO Supporting Underlying Metrics (.xlsx) for 2018-2022 | VERIFIED | Downloaded from home.treasury.gov; Premiums Per Policy field present |
| Upstream collection = NAIC PCMI Data Call subset to FIO | VERIFIED | Report + Disclaimer + press release |
| Geographic grain = ZIP x year (native); county/state derived | VERIFIED | Disclaimer: ZIP level; suppression >=10 insurers and >=50 policies (-22% ZIPs) |
| Years covered in primary = 2018-2022 only | VERIFIED | Disclaimer explicitly excludes 2023-2024 |
| Update cadence = one-time Jan 2025 public ZIP release; no FIO annual open series yet | VERIFIED (release); INFERRED (no recurring schedule on FIO index) |
| Future NAIC 2026 call covers 2018-2025; public report eyed early 2027 | VERIFIED | NAIC announcement URL in brief |
| Whether FIO will republish ZIP open data after 2026 call | UNKNOWN | Not stated on Treasury pages reviewed |
| Licence = U.S. gov public domain (17 U.S.C. sec. 105); commercial reuse OK | VERIFIED | Statute + resources.data.gov + Fiscal Data analogue + workbook as-is disclaimer |
| Attribution legally required as copyright condition | INFERRED no | Best practice / trust: cite FIO/Treasury; no seals/endorsement |
| BidDeed may use 2018-2022 series in KPIs + Fact Finders commercially | VERIFIED | Use official .xlsx; as-is caveats |
| Reventure 2018-2022 = Treasury/FIO | VERIFIED | Map tooltip matches primary |
| Reventure 2023-2025 = BLS PPI scaling (not Treasury ZIP) | VERIFIED as Reventure statement; UNTESTED scale fidelity | Do not label BidDeed MODELED years as Treasury |
| Reventure Premium % uses Zillow denominator | VERIFIED | Map tooltip |
| Exact unique ZIP count / national means from file | UNTESTED in this pass | Row count ~131,940 ZIP-years verified; means not published here (no invented numbers) |
| ConsumerFed claim that report was deleted from FIO site | UNTESTED / contested | Files still fetched live from home.treasury.gov on 2026-09-08 |

## Deliverable checklist

- [x] WebSearch + WebFetch primary identification (Treasury FIO / NAIC PCMI)
- [x] Exact dataset name, URL, publisher, years, grain, cadence, format
- [x] Licence / terms with official citations; commercial flags
- [x] Reventure public description vs primary (G1 map claim verified)
- [x] BidDeed reuse recommendation + attribution + ZIP gaps
- [x] Every factual claim URL-cited; no invented premium numbers; no internal vendor names; no tracker IDs in brief body

## Paths written

- `/workspace/docs/intel/INSURANCE_PREMIUM_KPI_SOURCE.md`
- `/workspace/docs/intel/G3_STATUS.md`

## Report-back (parent)

- **Primary:** Treasury FIO Supporting Underlying Metrics (PCMI) - https://home.treasury.gov/system/files/311/Supporting_Underlying_Metrics_and_Disclaimer_for_Analyses_of_US_Homeowners_Insurance_Markets_2018-2022.xlsx (press: https://home.treasury.gov/news/press-releases/jy2791)
- **Grain:** ZIP Code x year (county/state derived)
- **Cadence:** One-time Jan 2025 release for 2018-2022; next open ZIP extract UNKNOWN (NAIC public report eyed early 2027)
- **Licence one-liner:** U.S. Government public domain (17 U.S.C. sec. 105) + Treasury as-is disclaimer; commercial reuse allowed; cite FIO/Treasury; no endorsement/logos
- **BidDeed commercial reuse:** **VERIFIED** yes for 2018-2022 primary series

---

*End of G3_STATUS.md - 2026-09-08*
