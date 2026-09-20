export const CATEGORIES = [
  "billing",
  "account",
  "signal_report",
  "auction_data",
  "zoning",
  "bug",
  "feature",
  "security",
  "other",
] as const;
export const QUEUES = [
  "security",
  "billing",
  "technical",
  "data",
  "customer_success",
] as const;
type Category = typeof CATEGORIES[number];
type Queue = typeof QUEUES[number];
export type Ticket = {
  subject?: string;
  message: string;
  declaredCategory?: string;
  planTier?: string;
};
export type Decision = {
  category: Category;
  priority: "low" | "normal" | "high" | "urgent";
  queue: Queue;
  revenueRisk: boolean;
  requiresHuman: boolean;
  confidence: number;
  source: "deterministic" | "jev-shadow";
  reason: string;
};
export const JEV_QUESTIONS = {
  category: {
    type: "choice",
    instructions: "Classify the primary BidDeed.AI support need",
    criteria: {
      billing: "charges invoices subscriptions cancellations refunds",
      account: "login access profile permissions API keys",
      signal_report: "purchased SIGNAL$ report content or delivery",
      auction_data: "county auction parcel case calendar or tax deed data",
      zoning: "zoning land use development",
      bug: "broken or unavailable product behavior",
      feature: "new product behavior",
      security: "security privacy data exposure suspicious access",
      other: "none of these",
    },
  },
  urgency: {
    type: "score",
    instructions: "Score operational urgency, not tone",
    criteria: [
      "informational",
      "normal",
      "blocked or upcoming auction risk",
      "security legal financial loss or imminent auction deadline",
    ],
  },
  queue: {
    type: "choice",
    instructions: "Choose the review queue",
    criteria: {
      security: "security privacy exposure",
      billing: "charges invoices refunds subscriptions",
      technical: "bugs login API outage",
      data: "auction parcel report zoning quality",
      customer_success: "how-to features general help",
    },
  },
  revenueRisk: {
    type: "boolean",
    instructions:
      "Evidence of cancellation failed purchase churn or blocked paid value?",
  },
  requiresHuman: {
    type: "boolean",
    instructions:
      "Needs a human decision involving money permissions account state security legal matters or unsupported facts?",
  },
} as const;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  PHONE = /(?<!\d)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/g,
  KEY = /\bbd_(?:live|trial)_[\w-]+\b/g;
export function redact(t: Ticket) {
  const s = (v = "") =>
    v.replace(KEY, "[KEY]").replace(EMAIL, "[EMAIL]").replace(PHONE, "[PHONE]")
      .slice(0, 4000);
  return {
    subject: s(t.subject),
    message: s(t.message),
    declaredCategory: CATEGORIES.includes(t.declaredCategory as Category)
      ? t.declaredCategory!
      : "other",
    planTier: s(t.planTier).slice(0, 64),
  };
}
export function fallback(t: Ticket): Decision {
  const x = `${t.subject || ""} ${t.message}`.toLowerCase();
  const category: Category = /security|privacy|breach|hacked|exposed/.test(x)
    ? "security"
    : /refund|charge|invoice|billing|subscription|cancel/.test(x)
    ? "billing"
    : /login|sign[ -]?in|account|password|api key|access/.test(x)
    ? "account"
    : /report|signal\$|download|delivery/.test(x)
    ? "signal_report"
    : /auction|tax deed|foreclosure|parcel|case number|county/.test(x)
    ? "auction_data"
    : /zoning|land use/.test(x)
    ? "zoning"
    : /bug|broken|error|failed|not working|outage/.test(x)
    ? "bug"
    : /feature|request|wish|could you add/.test(x)
    ? "feature"
    : CATEGORIES.includes(t.declaredCategory as Category)
    ? t.declaredCategory as Category
    : "other";
  const queue: Queue = category === "security"
    ? "security"
    : category === "billing"
    ? "billing"
    : ["auction_data", "signal_report", "zoning"].includes(category)
    ? "data"
    : ["bug", "account"].includes(category)
    ? "technical"
    : "customer_success";
  const urgent = category === "security" || /today|tomorrow|imminent/.test(x),
    high = urgent ||
      /blocked|cannot access|failed purchase|double charg/.test(x);
  return {
    category,
    priority: urgent ? "urgent" : high ? "high" : "normal",
    queue,
    revenueRisk:
      /cancel|refund|charged|failed purchase|paid|upgrade|subscription/.test(x),
    requiresHuman: ["security", "billing", "account"].includes(category) ||
      /refund|legal|lawyer|attorney|should i bid|human|representative/.test(x),
    confidence: 1,
    source: "deterministic",
    reason: "local fallback",
  };
}
type Answers = {
  category: {
    choice: Category;
    probabilities?: Partial<Record<Category, number>>;
  };
  urgency: { score: number };
  queue: { choice: Queue; probabilities?: Partial<Record<Queue, number>> };
  revenueRisk: { probability: number };
  requiresHuman: { probability: number };
};
export type Evaluator = {
  evaluate(
    state: ReturnType<typeof redact>,
    questions: typeof JEV_QUESTIONS,
  ): Promise<{ answers: Answers; confidence?: { category?: number } }>;
};
export async function decide(t: Ticket, j?: Evaluator): Promise<Decision> {
  const f = fallback(t);
  if (!j) return f;
  try {
    const r = await j.evaluate(redact(t), JEV_QUESTIONS),
      a = r.answers,
      c = Math.min(
        a.category.probabilities?.[a.category.choice] || 0,
        a.queue.probabilities?.[a.queue.choice] || 0,
        r.confidence?.category || 0,
      );
    if (
      !CATEGORIES.includes(a.category.choice) ||
      !QUEUES.includes(a.queue.choice) || !Number.isFinite(a.urgency.score) ||
      a.urgency.score < 0 || a.urgency.score > 3 || c < .7
    ) return f;
    const p = a.urgency.score;
    return {
      category: a.category.choice,
      priority: p >= 2.5
        ? "urgent"
        : p >= 1.5
        ? "high"
        : p >= .5
        ? "normal"
        : "low",
      queue: a.queue.choice,
      revenueRisk: a.revenueRisk.probability >= .8,
      requiresHuman: a.requiresHuman.probability >= .8,
      confidence: c,
      source: "jev-shadow",
      reason: "typed advisory decision",
    };
  } catch {
    return f;
  }
}
