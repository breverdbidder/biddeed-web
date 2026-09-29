export type Strategy = "hold" | "flip" | "brrrr" | "primary";

export type Verdict = "buy" | "watch" | "pass";

export type CompStatus = "sold" | "active";

/** Dollar amount added to the comp to approximate the subject. Negative means the comp is nicer. */
export type Comp = {
  address: string;
  status: CompStatus;
  price: number;
  date: string;
  beds: number;
  baths: number;
  sqft: number;
  distanceMi: number;
  adjustment: number;
  note: string;
};

export type PricePoint = {
  date: string;
  price: number;
  event: string;
};

export type CompBasis = "asis" | "arv";

export type Deal = {
  id: string;
  sample: boolean;
  sourceUrl: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  neighborhood: string;
  propertyType: string;
  strategy: Strategy;
  listPrice: number;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotSqft: number;
  taxesAnnual: number;
  insuranceAnnual: number;
  hoaMonthly: number;
  rentMonthly: number;
  rehab: number;
  arv: number;
  /** Used when there is no comp set. */
  indicatedManual: number | null;
  compBasis: CompBasis;
  priceHistory: PricePoint[];
  comps: Comp[];
  neighborhoodNotes: string[];
  riskNotes: string[];
  narrative: string;
};

export type DealOverride = Partial<
  Pick<
    Deal,
    | "listPrice"
    | "rentMonthly"
    | "taxesAnnual"
    | "insuranceAnnual"
    | "hoaMonthly"
    | "rehab"
    | "arv"
    | "strategy"
    | "indicatedManual"
  >
>;

export type Assumptions = {
  downPct: number;
  ratePct: number;
  termYears: number;
  vacancyPct: number;
  managementPct: number;
  maintenancePct: number;
  capexPct: number;
  closingPct: number;
  appreciationPct: number;
  rentGrowthPct: number;
  expenseGrowthPct: number;
  rehabMonths: number;
  sellCostPct: number;
  hardMoneyPct: number;
  refiLtvPct: number;
  refiCostPct: number;
};

export type BuyBox = {
  maxPrice: number;
  minCap: number;
  minCoc: number;
  minDscr: number;
  minFlipMargin: number;
};

export type YearPoint = {
  year: number;
  cashFlow: number;
  cumulative: number;
  equity: number;
  value: number;
};

export type LineItem = {
  label: string;
  amount: number;
  strong?: boolean;
  rule?: "above" | "below";
};

export type Analysis = {
  verdict: Verdict;
  verdictLabel: string;
  headline: string;
  reasons: string[];
  risks: string[];
  metricLine: string;
  noi: number;
  capRate: number;
  coc: number;
  dscr: number;
  cashFlowAnnual: number;
  cashFlowMonthly: number;
  cashInvested: number;
  grossCashIn: number;
  loanAmount: number;
  paymentMonthly: number;
  pitiMonthly: number;
  gpr: number;
  egi: number;
  opex: number;
  debtService: number;
  indicated: number | null;
  priceGapPct: number | null;
  series: YearPoint[];
  statement: LineItem[];
  profit: number;
  margin: number;
  roi: number;
  mao: number;
  cashLeft: number;
  cashBack: number;
  fiveYearEquity: number;
  sensitivity: { label: string; value: string }[];
};
