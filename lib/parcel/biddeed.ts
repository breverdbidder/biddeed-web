import type { Assumptions, BuyBox, Deal, Verdict } from "./types.ts";
import { analyze, DEFAULT_ASSUMPTIONS, DEFAULT_BUY_BOX } from "./underwrite.ts";
import type { Analysis } from "./types.ts";

/** BidDeed property-page language. Parcel itself stays buy / watch / pass. */
export type BidDeedCall = "BID" | "REVIEW" | "SKIP";

export function toBidDeedCall(verdict: Verdict): BidDeedCall {
  if (verdict === "buy") return "BID";
  if (verdict === "watch") return "REVIEW";
  return "SKIP";
}

/**
 * Parcel never computes a maximum bid. BidDeed's max bid is the SIGNAL$ Max Bid
 * from its machine-learning model (formerly the Shapira formula): the chance a
 * third party buys and the predicted clearing price, learned from prior
 * auction results, plus, on foreclosures, the plaintiff's history of sale
 * price on the dollar against the final judgment. It stays withheld until the
 * model passes validation. The old fixed formula
 * (ARV x 70%) - repairs - $10,000 - min($25,000, 15% x ARV) is retired
 * (Ariel, 29 Sep 2026): do not reintroduce it or any other rule-of-thumb
 * ceiling here.
 */

/** Plain auction row. Field names match what a county calendar already has. */
export type AuctionLot = {
  id: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  caseNumber?: string;
  openingBid?: number;
  assessedValue?: number;
  taxesAnnual?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  rentMonthly?: number;
  rehab?: number;
  arv?: number;
  propertyType?: string;
};

export function dealFromAuctionLot(lot: AuctionLot): Deal {
  const price = lot.openingBid && lot.openingBid > 0 ? lot.openingBid : (lot.assessedValue ?? 0);
  const arv = lot.arv && lot.arv > 0 ? lot.arv : (lot.assessedValue ?? price);
  return {
    id: lot.id,
    sample: false,
    sourceUrl: "",
    address: lot.address,
    city: lot.city ?? "",
    state: lot.state ?? "FL",
    zip: lot.zip ?? "",
    neighborhood: lot.county ? `${lot.county} County` : "Auction lot",
    propertyType: lot.propertyType ?? "Single family",
    strategy: "hold",
    listPrice: price,
    beds: lot.beds ?? 0,
    baths: lot.baths ?? 0,
    sqft: lot.sqft ?? 0,
    yearBuilt: lot.yearBuilt ?? 0,
    lotSqft: 0,
    taxesAnnual: lot.taxesAnnual ?? 0,
    insuranceAnnual: price > 0 ? Math.round(price * 0.008) : 0,
    hoaMonthly: 0,
    rentMonthly: lot.rentMonthly ?? 0,
    rehab: lot.rehab ?? 0,
    arv,
    indicatedManual: lot.assessedValue && lot.assessedValue > 0 ? lot.assessedValue : null,
    compBasis: "asis",
    priceHistory: price > 0 ? [{ date: "Opening bid", price, event: lot.caseNumber ?? "Auction" }] : [],
    comps: [],
    neighborhoodNotes: [
      lot.county
        ? `Opened from a ${lot.county} County auction row. Confirm the clerk file before you bid.`
        : "Opened from an auction row. Confirm the clerk file before you bid.",
    ],
    riskNotes: [
      "Opening bid is not a market value. Parcel uses it as the basis until you replace it.",
      "Insurance is estimated at 0.8% of the basis until you enter a quote.",
    ],
    narrative: lot.caseNumber
      ? `Case ${lot.caseNumber}. No listing site and no model vendor were queried.`
      : "Built from the auction row you passed in. No listing site and no model vendor were queried.",
  };
}

export type LotUnderwriting = {
  deal: Deal;
  analysis: Analysis;
  call: BidDeedCall;
};

export function underwriteLot(
  lot: AuctionLot,
  assumptions: Assumptions = DEFAULT_ASSUMPTIONS,
  box: BuyBox = DEFAULT_BUY_BOX,
): LotUnderwriting {
  const deal = dealFromAuctionLot(lot);
  const analysis = analyze(deal, assumptions, box);
  return {
    deal,
    analysis,
    call: toBidDeedCall(analysis.verdict),
  };
}
