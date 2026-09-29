import type {
  Analysis,
  Assumptions,
  BuyBox,
  Deal,
  LineItem,
  Strategy,
  Verdict,
  YearPoint,
} from "./types.ts";
import { money, pct, ratio } from "./format.ts";

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  downPct: 20,
  ratePct: 6.75,
  termYears: 30,
  vacancyPct: 5,
  managementPct: 8,
  maintenancePct: 5,
  capexPct: 5,
  closingPct: 2.5,
  appreciationPct: 3,
  rentGrowthPct: 2.5,
  expenseGrowthPct: 2.5,
  rehabMonths: 6,
  sellCostPct: 6,
  hardMoneyPct: 11,
  refiLtvPct: 70,
  refiCostPct: 2,
};

export const DEFAULT_BUY_BOX: BuyBox = {
  maxPrice: 450000,
  minCap: 6.5,
  minCoc: 8,
  minDscr: 1.15,
  minFlipMargin: 12,
};

export const STRATEGY_LABEL: Record<Strategy, string> = {
  hold: "Buy and hold",
  flip: "Flip",
  brrrr: "BRRRR",
  primary: "Primary home",
};

export function mortgagePayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  const pow = (1 + r) ** n;
  return (principal * r * pow) / (pow - 1);
}

export function indicatedValue(deal: Deal): number | null {
  if (deal.comps.length > 0) {
    const vals = deal.comps.map((c) => c.price + c.adjustment).sort((a, b) => a - b);
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 === 1 ? vals[mid]! : (vals[mid - 1]! + vals[mid]!) / 2;
  }
  if (deal.indicatedManual && deal.indicatedManual > 0) return deal.indicatedManual;
  return null;
}

type Core = {
  loan: number;
  pi: number;
  ds: number;
  gpr: number;
  egi: number;
  taxes: number;
  insurance: number;
  hoa: number;
  management: number;
  maintenance: number;
  capex: number;
  opex: number;
  noi: number;
  cf: number;
  cashIn: number;
  coc: number;
  dscr: number;
  capRate: number;
  piti: number;
};

function operations(deal: Deal, a: Assumptions, rentMonthly = deal.rentMonthly): Core {
  const price = deal.listPrice;
  const loan = price * (1 - a.downPct / 100);
  const pi = mortgagePayment(loan, a.ratePct, a.termYears);
  const ds = pi * 12;
  const gpr = rentMonthly * 12;
  const egi = gpr * (1 - a.vacancyPct / 100);
  const taxes = deal.taxesAnnual;
  const insurance = deal.insuranceAnnual;
  const hoa = deal.hoaMonthly * 12;
  const management = egi * (a.managementPct / 100);
  const maintenance = gpr * (a.maintenancePct / 100);
  const capex = gpr * (a.capexPct / 100);
  const opex = taxes + insurance + hoa + management + maintenance + capex;
  const noi = egi - opex;
  const cf = noi - ds;
  const cashIn = price * (a.downPct / 100) + price * (a.closingPct / 100) + deal.rehab;
  const coc = cashIn > 0 ? (cf / cashIn) * 100 : cf > 0 ? Number.POSITIVE_INFINITY : 0;
  const dscr = ds > 0 ? noi / ds : noi > 0 ? Number.POSITIVE_INFINITY : 0;
  const capRate = price > 0 ? (noi / price) * 100 : 0;
  const piti = pi + taxes / 12 + insurance / 12 + deal.hoaMonthly;
  return {
    loan,
    pi,
    ds,
    gpr,
    egi,
    taxes,
    insurance,
    hoa,
    management,
    maintenance,
    capex,
    opex,
    noi,
    cf,
    cashIn,
    coc,
    dscr,
    capRate,
    piti,
  };
}

function holdSeries(deal: Deal, a: Assumptions, mode: "hold" | "primary"): YearPoint[] {
  const loan0 = deal.listPrice * (1 - a.downPct / 100);
  const pi = mortgagePayment(loan0, a.ratePct, a.termYears);
  const r = a.ratePct / 100 / 12;
  let balance = loan0;
  const rows: YearPoint[] = [];
  let cumulative = 0;
  for (let year = 1; year <= 10; year += 1) {
    const gRent = (1 + a.rentGrowthPct / 100) ** (year - 1);
    const gExp = (1 + a.expenseGrowthPct / 100) ** (year - 1);
    const gpr = deal.rentMonthly * 12 * gRent;
    const fixed = (deal.taxesAnnual + deal.insuranceAnnual + deal.hoaMonthly * 12) * gExp;
    const maint = gpr * (a.maintenancePct / 100);
    const capex = gpr * (a.capexPct / 100);
    let interest = 0;
    let principal = 0;
    for (let m = 0; m < 12; m += 1) {
      const int = balance * r;
      const prin = Math.min(Math.max(pi - int, 0), balance);
      interest += int;
      principal += prin;
      balance = Math.max(0, balance - prin);
    }
    const value = deal.listPrice * (1 + a.appreciationPct / 100) ** year;
    let cashFlow: number;
    if (mode === "primary") {
      cashFlow = gpr - (pi * 12 + fixed + maint + capex);
    } else {
      const egi = gpr * (1 - a.vacancyPct / 100);
      const management = egi * (a.managementPct / 100);
      const noi = egi - fixed - management - maint - capex;
      cashFlow = noi - interest - principal;
    }
    cumulative += cashFlow;
    rows.push({
      year,
      cashFlow,
      cumulative,
      equity: value - balance,
      value,
    });
  }
  return rows;
}

function line(label: string, amount: number, extra?: Partial<LineItem>): LineItem {
  return { label, amount, ...extra };
}

const HEADLINES: Record<Strategy, Record<Verdict, string>> = {
  hold: {
    buy: "Buy it as a rental.",
    watch: "Close, but it does not clear the box.",
    pass: "Pass. The rent does not carry the debt.",
  },
  flip: {
    buy: "Buy it to flip. The spread is real.",
    watch: "Thin spread. Only if the basis or the timeline improves.",
    pass: "Pass. Rehab and selling costs eat the spread.",
  },
  brrrr: {
    buy: "The refinance leaves an acceptable return.",
    watch: "Cash comes back, but the permanent loan is tight.",
    pass: "Pass. Too much cash stays in, or the new loan does not cover.",
  },
  primary: {
    buy: "Sensible to live here.",
    watch: "You would pay up to live on this block.",
    pass: "Rent a similar place. Buying is the expensive way to live here.",
  },
};

const LABELS: Record<Strategy, Record<Verdict, string>> = {
  hold: { buy: "Buy", watch: "Watch", pass: "Pass" },
  flip: { buy: "Buy", watch: "Watch", pass: "Pass" },
  brrrr: { buy: "Buy", watch: "Watch", pass: "Pass" },
  primary: { buy: "Live here", watch: "Stretch", pass: "Rent instead" },
};

function downgrade(v: Verdict): Verdict {
  if (v === "buy") return "watch";
  if (v === "watch") return "pass";
  return "pass";
}

export function analyze(deal: Deal, assumptions: Assumptions, box: BuyBox): Analysis {
  const a = assumptions;
  const op = operations(deal, a);
  const indicated = indicatedValue(deal);
  const compareTo = deal.compBasis === "arv" ? deal.arv : deal.listPrice;
  const priceGapPct =
    indicated && indicated > 0 ? ((compareTo - indicated) / indicated) * 100 : null;

  const months = Math.max(a.rehabMonths, 0);
  const holdYears = months / 12;
  const purchaseLoan = deal.listPrice * (1 - a.downPct / 100);
  const flipInterest = purchaseLoan * (a.ratePct / 100) * holdYears;
  const carry = (deal.taxesAnnual + deal.insuranceAnnual + deal.hoaMonthly * 12) * holdYears;
  const buyClose = deal.listPrice * (a.closingPct / 100);
  const sellCosts = deal.arv * (a.sellCostPct / 100);
  const profit =
    deal.arv - sellCosts - deal.listPrice - deal.rehab - buyClose - flipInterest - carry;
  const flipCash =
    deal.listPrice * (a.downPct / 100) + deal.rehab + buyClose + flipInterest + carry;
  const margin = deal.arv > 0 ? (profit / deal.arv) * 100 : 0;
  const roi = flipCash > 0 ? (profit / flipCash) * 100 : 0;

  const hardInterest = purchaseLoan * (a.hardMoneyPct / 100) * holdYears;
  const brrrrCashIn =
    deal.listPrice * (a.downPct / 100) + deal.rehab + buyClose + hardInterest + carry;
  const newLoan = deal.arv * (a.refiLtvPct / 100);
  const refiCost = newLoan * (a.refiCostPct / 100);
  const cashBack = newLoan - purchaseLoan - refiCost;
  const cashLeft = brrrrCashIn - cashBack;
  const newPi = mortgagePayment(newLoan, a.ratePct, a.termYears);
  const newDs = newPi * 12;
  const brrrrCf = op.noi - newDs;
  const brrrrDscr = newDs > 0 ? op.noi / newDs : 0;
  const brrrrCoc =
    cashLeft > 1500 ? (brrrrCf / cashLeft) * 100 : brrrrCf > 0 ? Number.POSITIVE_INFINITY : 0;

  const series =
    deal.strategy === "flip" || deal.strategy === "brrrr"
      ? []
      : holdSeries(deal, a, deal.strategy === "primary" ? "primary" : "hold");
  const fiveYearEquity = series[4]?.equity ?? 0;

  const reasons: string[] = [];
  const risks: string[] = [...deal.riskNotes];
  let verdict: Verdict = "pass";

  if (deal.strategy === "hold") {
    const gates = [
      op.capRate >= box.minCap,
      op.coc >= box.minCoc,
      op.dscr >= box.minDscr,
    ];
    const hits = gates.filter(Boolean).length;
    verdict = hits === 3 ? "buy" : hits === 2 ? "watch" : "pass";
    if (op.cf < 0 && verdict === "buy") verdict = "watch";
    if (deal.listPrice > box.maxPrice) verdict = verdict === "pass" ? "pass" : downgrade(verdict);
    if (priceGapPct !== null && deal.compBasis === "asis" && priceGapPct > 8) {
      verdict = downgrade(verdict);
    }
    reasons.push(
      `Cap rate ${pct(op.capRate)} against a ${pct(box.minCap, 1)} floor. NOI is ${money(op.noi)} on ${money(deal.listPrice)}.`,
    );
    reasons.push(
      `Cash-on-cash ${pct(op.coc)} on ${money(op.cashIn)} cash in. Annual cash flow ${money(op.cf)}.`,
    );
    reasons.push(
      `DSCR ${ratio(op.dscr)} versus ${ratio(box.minDscr)}. Debt service is ${money(op.ds)} a year at ${pct(a.ratePct, 2)} / ${a.termYears} years.`,
    );
    if (priceGapPct !== null) {
      reasons.push(
        priceGapPct <= 0
          ? `Listed ${pct(Math.abs(priceGapPct))} under the adjusted comp median of ${money(indicated ?? 0)}.`
          : `Listed ${pct(priceGapPct)} over the adjusted comp median of ${money(indicated ?? 0)}.`,
      );
    }
    if (deal.listPrice > box.maxPrice) {
      reasons.push(`Price is above your ${money(box.maxPrice)} cap, so it cannot be a clean buy.`);
    }
  } else if (deal.strategy === "flip") {
    if (deal.arv <= 0) {
      verdict = "pass";
      reasons.push("Set an after-repair value. A flip without an ARV is a guess.");
    } else if (margin >= box.minFlipMargin && profit > 0) {
      verdict = "buy";
    } else if (margin >= 8 && profit > 0) {
      verdict = "watch";
    } else {
      verdict = "pass";
    }
    if (deal.listPrice > box.maxPrice && verdict === "buy") verdict = "watch";
    reasons.push(
      `Profit ${money(profit)} after ${pct(a.sellCostPct, 0)} selling costs. Margin is ${pct(margin)} of ARV ${money(deal.arv)}.`,
    );
    reasons.push(
      `Cash in the project is about ${money(flipCash)}, so the return on cash is ${pct(roi)}.`,
    );
  } else if (deal.strategy === "brrrr") {
    const cocOk = !Number.isFinite(brrrrCoc) ? brrrrCf > 0 : brrrrCoc >= box.minCoc;
    if (brrrrDscr >= box.minDscr && cocOk && brrrrCf > 0) verdict = "buy";
    else if (brrrrDscr >= 1 && brrrrCf >= 0) verdict = "watch";
    else verdict = "pass";
    if (deal.arv <= deal.listPrice) verdict = "pass";
    if (priceGapPct !== null && deal.compBasis === "arv" && priceGapPct > 8) {
      verdict = downgrade(verdict);
    }
    if (deal.listPrice > box.maxPrice && verdict === "buy") verdict = "watch";
    reasons.push(
      cashLeft <= 0
        ? `Refinance at ${pct(a.refiLtvPct, 0)} of ARV returns all cash and then some (${money(Math.abs(cashLeft))} extra).`
        : `About ${money(cashLeft)} stays in the deal after a ${pct(a.refiLtvPct, 0)} refinance.`,
    );
    reasons.push(
      `Stabilized cash flow ${money(brrrrCf)} a year. DSCR on the new loan is ${ratio(brrrrDscr)}.`,
    );
    reasons.push(
      `Cash-on-cash on the money left in is ${pct(brrrrCoc)}. Cap rate on ARV is ${pct(deal.arv > 0 ? (op.noi / deal.arv) * 100 : 0)}.`,
    );
    if (priceGapPct !== null && deal.compBasis === "arv") {
      reasons.push(
        priceGapPct > 3
          ? `Your ARV sits ${pct(priceGapPct)} above renovated comps (${money(indicated ?? 0)}). That is the risky number.`
          : `ARV is within ${pct(Math.abs(priceGapPct))} of the renovated-comp median (${money(indicated ?? 0)}).`,
      );
    }
  } else {
    const rentRatio = deal.rentMonthly > 0 ? op.piti / deal.rentMonthly : Number.POSITIVE_INFINITY;
    if (rentRatio <= 1.2 && (priceGapPct === null || priceGapPct <= 5)) verdict = "buy";
    else if (rentRatio <= 1.45) verdict = "watch";
    else verdict = "pass";
    if (deal.listPrice > box.maxPrice && verdict === "buy") verdict = "watch";
    reasons.push(
      `Monthly housing cost is ${money(op.piti)} against market rent of ${money(deal.rentMonthly)} (${pct((rentRatio - 1) * 100, 0)} ${rentRatio >= 1 ? "more" : "less"}).`,
    );
    reasons.push(
      `Five-year equity, principal plus ${pct(a.appreciationPct, 1)} appreciation, is about ${money(fiveYearEquity)}.`,
    );
    if (deal.propertyType.toLowerCase().includes("duplex") || deal.beds >= 4) {
      reasons.push(
        "On a multi-unit, the rent input is income if you do not occupy every unit. A ratio under 1.0 is a house-hack, not proof a single family is cheap.",
      );
    }
    if (priceGapPct !== null) {
      reasons.push(
        priceGapPct <= 0
          ? `Price is ${pct(Math.abs(priceGapPct))} under the comp median.`
          : `Price is ${pct(priceGapPct)} over the comp median.`,
      );
    }
  }

  if (deal.taxesAnnual <= 0 && deal.strategy !== "flip") {
    risks.unshift("Taxes are zero in this file. The yield is fiction until you put in the bill.");
    if (verdict === "buy") verdict = "watch";
  }
  if (deal.yearBuilt > 0 && deal.yearBuilt < 1978) {
    const reservePct = a.maintenancePct + a.capexPct;
    if (reservePct < 8 && (deal.strategy === "hold" || deal.strategy === "brrrr")) {
      risks.push(
        `Built in ${deal.yearBuilt}. Maintenance plus reserves are only ${pct(reservePct, 0)} of rent — light for the age.`,
      );
    }
  }
  if (deal.strategy === "primary" && deal.propertyType.toLowerCase().includes("duplex")) {
    risks.push("Living in one unit and renting the other changes both the payment and the vacancy. Model the unit you would occupy separately.");
  }

  const altRate = operations(deal, { ...a, ratePct: Math.max(0, a.ratePct - 1) });
  const lightRent = operations(deal, a, deal.rentMonthly * 0.95);
  const sensitivity: { label: string; value: string }[] = [];
  if (deal.strategy === "hold") {
    sensitivity.push({
      label: `Rate at ${pct(Math.max(0, a.ratePct - 1), 2)}`,
      value: `${pct(altRate.coc)} cash-on-cash`,
    });
    sensitivity.push({
      label: "Rent 5% light",
      value: `${money(lightRent.cf)} cash flow`,
    });
  } else if (deal.strategy === "brrrr") {
    const softer = analyzeInnerRate(deal, { ...a, ratePct: Math.max(0, a.ratePct - 1) });
    sensitivity.push({
      label: `Permanent rate ${pct(Math.max(0, a.ratePct - 1), 2)}`,
      value: `${money(softer.cf)} cash flow`,
    });
    sensitivity.push({
      label: "Rent 5% light",
      value: `NOI ${money(lightRent.noi)}`,
    });
  } else if (deal.strategy === "flip") {
    sensitivity.push({
      label: "ARV 5% light",
      value: money(profit - deal.arv * 0.05),
    });
    sensitivity.push({
      label: "Extra month of carry",
      value: money(profit - (deal.taxesAnnual + deal.insuranceAnnual) / 12 - purchaseLoan * (a.ratePct / 100) / 12),
    });
  } else {
    sensitivity.push({
      label: `Rate at ${pct(Math.max(0, a.ratePct - 1), 2)}`,
      value: `${money(altRate.piti)} / month`,
    });
    sensitivity.push({
      label: "Down payment +10 pts",
      value: `${money(operations(deal, { ...a, downPct: Math.min(100, a.downPct + 10) }).piti)} / month`,
    });
  }

  let statement: LineItem[] = [];
  let metricLine = "";
  let noi = op.noi;
  let capRate = op.capRate;
  let coc = op.coc;
  let dscr = op.dscr;
  let cashFlowAnnual = op.cf;
  let cashInvested = op.cashIn;
  let paymentMonthly = op.pi;
  let debtService = op.ds;
  let loanAmount = op.loan;

  if (deal.strategy === "hold") {
    statement = [
      line("Gross potential rent", op.gpr),
      line("Vacancy", -op.gpr * (a.vacancyPct / 100)),
      line("Effective gross income", op.egi, { strong: true, rule: "above" }),
      line("Taxes", -op.taxes),
      line("Insurance", -op.insurance),
      line("HOA", -op.hoa),
      line("Management", -op.management),
      line("Maintenance", -op.maintenance),
      line("Capex reserve", -op.capex),
      line("Operating expenses", -op.opex, { strong: true, rule: "above" }),
      line("Net operating income", op.noi, { strong: true, rule: "above" }),
      line("Debt service", -op.ds),
      line("Cash flow", op.cf, { strong: true, rule: "above" }),
    ];
    metricLine = `${pct(op.capRate)} cap · ${pct(op.coc)} cash-on-cash`;
  } else if (deal.strategy === "flip") {
    statement = [
      line("After-repair value", deal.arv),
      line("Selling costs", -sellCosts),
      line("Net sale", deal.arv - sellCosts, { strong: true, rule: "above" }),
      line("Purchase", -deal.listPrice),
      line("Rehab", -deal.rehab),
      line("Purchase closing", -buyClose),
      line("Interest carry", -flipInterest),
      line("Tax and insurance carry", -carry),
      line("Profit", profit, { strong: true, rule: "above" }),
    ];
    noi = 0;
    capRate = 0;
    coc = roi;
    dscr = 0;
    cashFlowAnnual = profit;
    cashInvested = flipCash;
    paymentMonthly = 0;
    debtService = 0;
    loanAmount = purchaseLoan;
    metricLine = `${pct(margin)} margin · ${money(profit)} profit`;
  } else if (deal.strategy === "brrrr") {
    statement = [
      line("Down payment", deal.listPrice * (a.downPct / 100)),
      line("Rehab", deal.rehab),
      line("Purchase closing", buyClose),
      line("Hard-money interest", hardInterest),
      line("Carry during rehab", carry),
      line("Cash in", brrrrCashIn, { strong: true, rule: "above" }),
      line("New loan", newLoan),
      line("Pay off purchase loan", -purchaseLoan),
      line("Refinance costs", -refiCost),
      line("Cash back", cashBack, { strong: true, rule: "above" }),
      line("Cash left in deal", cashLeft, { strong: true, rule: "above" }),
      line("Stabilized NOI", op.noi, { rule: "above" }),
      line("New debt service", -newDs),
      line("Cash flow after refi", brrrrCf, { strong: true, rule: "above" }),
    ];
    coc = brrrrCoc;
    dscr = brrrrDscr;
    cashFlowAnnual = brrrrCf;
    cashInvested = Math.max(cashLeft, 0);
    paymentMonthly = newPi;
    debtService = newDs;
    loanAmount = newLoan;
    capRate = deal.arv > 0 ? (op.noi / deal.arv) * 100 : 0;
    metricLine = `${money(cashLeft)} left in · DSCR ${ratio(brrrrDscr)}`;
  } else {
    statement = [
      line("Principal and interest", op.pi * 12),
      line("Taxes", op.taxes),
      line("Insurance", op.insurance),
      line("HOA", op.hoa),
      line("Annual housing cost", op.piti * 12, { strong: true, rule: "above" }),
      line("Market rent, annual", op.gpr),
      line("Own versus rent", op.gpr - op.piti * 12, { strong: true, rule: "above" }),
    ];
    paymentMonthly = op.piti;
    cashFlowAnnual = op.gpr - op.piti * 12;
    cashInvested = deal.listPrice * (a.downPct / 100) + buyClose;
    coc = 0;
    dscr = 0;
    metricLine = `${money(op.piti)} / mo · rent ${money(deal.rentMonthly)}`;
  }

  if (risks.length === 0) {
    risks.push("Every input is an assumption until you have the lease, the tax bill, and an insurance quote.");
  }

  return {
    verdict,
    verdictLabel: LABELS[deal.strategy][verdict],
    headline: HEADLINES[deal.strategy][verdict],
    reasons: reasons.slice(0, 4),
    risks: risks.slice(0, 4),
    metricLine,
    noi,
    capRate,
    coc,
    dscr,
    cashFlowAnnual,
    cashFlowMonthly: cashFlowAnnual / 12,
    cashInvested,
    loanAmount,
    grossCashIn: deal.strategy === "brrrr" ? brrrrCashIn : deal.strategy === "flip" ? flipCash : op.cashIn,
    paymentMonthly,
    pitiMonthly: op.piti,
    gpr: op.gpr,
    egi: op.egi,
    opex: op.opex,
    debtService,
    indicated,
    priceGapPct,
    series,
    statement,
    profit,
    margin,
    roi,
    cashLeft,
    cashBack,
    fiveYearEquity,
    sensitivity,
  };
}

function analyzeInnerRate(deal: Deal, a: Assumptions): { cf: number } {
  const op = operations(deal, a);
  const newLoan = deal.arv * (a.refiLtvPct / 100);
  const newDs = mortgagePayment(newLoan, a.ratePct, a.termYears) * 12;
  return { cf: op.noi - newDs };
}

export function memoText(deal: Deal, analysis: Analysis, a: Assumptions): string {
  const place = `${deal.address}, ${deal.city}, ${deal.state} ${deal.zip}`;
  const lines = [
    "PARCEL — investment memo",
    place,
    `${deal.neighborhood} · ${deal.propertyType} · ${STRATEGY_LABEL[deal.strategy]}`,
    "",
    `Call: ${analysis.verdictLabel.toUpperCase()}`,
    analysis.headline,
    "",
    `Price ${money(deal.listPrice)} · Rent ${money(deal.rentMonthly)}/mo · ${analysis.metricLine}`,
    "",
    "Why",
    ...analysis.reasons.map((r) => `- ${r}`),
    "",
    "Risks",
    ...analysis.risks.map((r) => `- ${r}`),
    "",
    "Statement",
    ...analysis.statement.map((row) => `${row.label}: ${money(row.amount)}`),
    "",
    `Assumptions: ${pct(a.downPct, 0)} down, ${pct(a.ratePct, 2)} / ${a.termYears} yr, vacancy ${pct(a.vacancyPct, 0)}, management ${pct(a.managementPct, 0)}, maintenance ${pct(a.maintenancePct, 0)}, reserves ${pct(a.capexPct, 0)}, closing ${pct(a.closingPct, 1)}.`,
    "",
    "Sample files are modeled desk examples, not a live pull from a listing site or the county. Replace any figure that does not match the file in front of you.",
  ];
  return lines.join("\n");
}
