/** The saved brief JSON (schema investment_brief.v1), written by the skill runner and read by /briefs/<id>. */
export type Verdict = 'BID' | 'REVIEW' | 'SKIP' | 'INCOMPLETE'

export interface Cited<T> { value: T; source: string }

export interface ScoreLine {
  all_in: number
  flip_margin: number
  max_bid: number
  verdict: Verdict
  inputs: { bid: number; rehab: number; closing: number; holding: number; arv: number; opening_bid: number }
  gross?: number; noi?: number; cap?: number; cash_left_in?: number; cash_flow?: number; coc?: number
  refi?: { rate: number; years: number; loan: number; sized_by: string; debt_service: number; dscr: number | null }
  gates: Record<string, { value: number | null; gate: number; pass: boolean }>
  max_bid_binding?: string
  open_items: string[]
}

export interface BriefProperty {
  id: string
  case_number: string
  address: string | null
  auction_date: string | null
  opening_bid: number | null
  judgment: number | null
  verdict: Verdict
  verdict_capped?: boolean
  bid?: number
  score: ScoreLine | null
  at_max_bid: ScoreLine | null
  room_to_max_bid: number | null
  open_items: string[]
  example_numbers?: string[]
  evidence: {
    arv: Cited<number> | null
    rehab: Cited<number> | null
    rent: { monthly: number; source: string; example: boolean } | null
    comps: { table?: { columns: string[]; rows: unknown[][] }; note?: string } | null
    zoning: { district: string | null; jurisdiction: string | null; note?: string } | null
    liens: { instruments: number | null; surviving: number | null; note: string } | null
    surplus: { status: string | null; sold_for: number | null } | null
    recorded: { opening_bid: number | null; judgment: number | null; assessed_value: number | null } | null
  }
}

export interface Brief {
  schema: 'investment_brief.v1'
  generated_at: string
  input: {
    market: { county: string; cities: string[] }
    window_days: number
    strategy: string
    gates: Record<string, number | null>
    capital: { refi_rate?: number; refi_years?: number }
    audience: { name?: string; meeting_date?: string } | null
    repair_scope: string
  }
  window: { from: string; to: string }
  counts: { on_radar: number; confirmed: number; excluded: number }
  screen: Array<{
    rank: number; case_number: string; address: string | null; auction_date: string | null; opening_bid: number | null
    verdict: Verdict; max_bid: number | null; room_to_max_bid: number | null
    cap: number | null; coc: number | null; dscr: number | null; flip_margin: number | null
  }>
  properties: BriefProperty[]
  excluded: Array<{ case_number: string; address: string | null; auction_date: string | null; reason: string }>
  disclosures: string[]
  sources: string[]
}

export interface BriefBrand {
  name: string
  logo_url: string | null
  license_no: string | null
  primary_color: string | null
  white_label: boolean
}
