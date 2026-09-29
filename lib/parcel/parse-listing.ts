export type ParsedListing = {
  address?: string;
  cityLine?: string;
  listPrice?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  taxesAnnual?: number;
  insuranceAnnual?: number;
  rentMonthly?: number;
  hoaMonthly?: number;
  yearBuilt?: number;
  rehab?: number;
  arv?: number;
  sourceUrl?: string;
};

function dollars(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

export function parseListingPaste(raw: string): ParsedListing {
  const text = raw.trim();
  if (!text) return {};
  const out: ParsedListing = {};
  const url = text.match(/https?:\/\/\S+/);
  if (url) out.sourceUrl = url[0].replace(/[),.;]+$/, "");

  const labeled = (re: RegExp): number | undefined => {
    const match = text.match(re);
    if (!match?.[1]) return undefined;
    const n = dollars(match[1]);
    return Number.isFinite(n) ? n : undefined;
  };

  out.listPrice =
    labeled(/(?:price|list(?:ed)?|asking|purchase)[:\s]*\$?\s*([\d,]{4,})/i) ??
    labeled(/\$\s*([\d,]{5,})/);
  out.taxesAnnual = labeled(/tax(?:es)?[:\s]*\$?\s*([\d,]{3,})/i);
  out.rentMonthly = labeled(/rent[:\s]*\$?\s*([\d,]{3,})/i);
  out.insuranceAnnual = labeled(/ins(?:urance)?[:\s]*\$?\s*([\d,]{3,})/i);
  out.hoaMonthly = labeled(/hoa[:\s]*\$?\s*([\d,]{2,})/i);
  out.rehab = labeled(/rehab[:\s]*\$?\s*([\d,]{3,})/i);
  out.arv = labeled(/(?:arv|after[- ]repair)[:\s]*\$?\s*([\d,]{4,})/i);

  const beds = text.match(/(\d+(?:\.\d+)?)\s*(?:bd|beds?|br)\b/i);
  if (beds?.[1]) out.beds = Number(beds[1]);
  const baths = text.match(/(\d+(?:\.\d+)?)\s*(?:ba|baths?)\b/i);
  if (baths?.[1]) out.baths = Number(baths[1]);
  const sqft = text.match(/([\d,]{3,})\s*(?:sq\.?\s*ft|sqft|sf)\b/i);
  if (sqft?.[1]) out.sqft = dollars(sqft[1]);
  const year = text.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
  if (year?.[1]) {
    const y = Number(year[1]);
    if (y >= 1850 && y <= 2026) out.yearBuilt = y;
  }

  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const addressLine = lines.find((line) => /^\d{1,6}\s+[A-Za-z0-9]/.test(line) && !line.includes("http"));
  if (addressLine) {
    const parts = addressLine.split(",").map((part) => part.trim());
    out.address = parts[0];
    if (parts.length > 1) out.cityLine = parts.slice(1).join(", ");
  }

  return out;
}
