/**
 * Deed Skills (PARITY CP-6 / D12), client-safe types, copy and formatting.
 *
 * A skill runs one or more of six read-only tools against one auction and
 * returns what the county records say, with the source named. The tools live
 * in Supabase (migration cp6_skills, service-role only) and are called through
 * /api/deed/skills/run; nothing here computes a figure of its own.
 */

export type SkillTool = 'lien_survival' | 'surplus_check' | 'zoning' | 'comps' | 'repair_estimate' | 'max_bid'

export const SKILL_TOOLS: SkillTool[] = ['lien_survival', 'surplus_check', 'zoning', 'comps', 'repair_estimate', 'max_bid']

export const TOOL_NAMES: Record<SkillTool, string> = {
  lien_survival: 'Lien survival',
  surplus_check: 'Surplus check',
  zoning: 'Zoning',
  comps: 'Comparable sales',
  repair_estimate: 'Repair estimate',
  max_bid: 'Max bid',
}

export interface SkillSummary {
  id: string | null
  slug: string
  kind: 'system' | 'user'
  name: string
  description: string
  instructions: string
  tools: SkillTool[]
  version: number
  mine: boolean
  enabled: boolean
  pinned: boolean
}

/** Mirrors the six rows the migration seeds, for the signed-out library and the slash menu. */
export const SYSTEM_SKILLS: SkillSummary[] = [
  {
    slug: 'lien_survival',
    name: 'Lien survival',
    description: 'Every recorded mortgage, lien and judgment on the case, in recording order, with which ones survive the sale.',
    instructions: '',
    tools: ['lien_survival'],
  },
  {
    slug: 'surplus_check',
    name: 'Surplus check',
    description: "Whether a sale produced surplus funds: sale price against the judgment or opening bid, and the clerk's figure.",
    instructions: '',
    tools: ['surplus_check'],
  },
  {
    slug: 'zoning',
    name: 'Zoning',
    description: "The parcel's zoning district, land use, setbacks, height, density and the ordinance they come from.",
    instructions: '',
    tools: ['zoning'],
  },
  {
    slug: 'comps',
    name: 'Comparable sales',
    description: 'Recent sales of similar homes in the same ZIP: same use, living area within 30%, sold 2022 or later.',
    instructions: '',
    tools: ['comps'],
  },
  {
    slug: 'repair_estimate',
    name: 'Repair estimate',
    description: 'A starting rehab budget from catalog unit costs sized to the living area: cosmetic, standard or gut scope.',
    instructions: '',
    tools: ['repair_estimate'],
  },
  {
    slug: 'max_bid',
    name: 'Max bid',
    description: "The recorded numbers a max bid is built from: plaintiff's max bid, opening bid, judgment and county values.",
    instructions: '',
    tools: ['max_bid'],
  },
].map((s) => ({ ...s, id: null, kind: 'system' as const, version: 1, mine: false, enabled: true, pinned: false }) as SkillSummary)

export interface SkillFact {
  label: string
  value: unknown
  format?: 'usd' | 'usd_range'
  detail?: string | null
  url?: string | null
}

export interface ToolResult {
  tool: SkillTool | string
  title: string
  status: 'ok' | 'empty' | 'withheld'
  facts: SkillFact[]
  table?: { columns: string[]; rows: unknown[][] }
  source: string
  note: string
}

export interface SkillRun {
  skill: { id: string; slug: string; kind: 'system' | 'user'; name: string; instructions: string }
  auction: {
    id: string
    county: string
    case_number: string
    address: string | null
    auction_date: string | null
    sale_type: string | null
  }
  results: ToolResult[]
  ms: number
}

export interface SkillLibrary {
  signed_in: boolean
  can_run: boolean
  skills: SkillSummary[]
}

export const REPAIR_SCOPES = [
  { value: 'cosmetic', label: 'Cosmetic' },
  { value: 'standard', label: 'Standard' },
  { value: 'gut', label: 'Gut' },
] as const

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

/** One cell or fact value as text. Missing is an em dash, never a zero. */
export function formatValue(value: unknown, format?: SkillFact['format']): string {
  if (value === null || value === undefined || value === '') return '—'
  if (format === 'usd') {
    const n = asNumber(value)
    return n === null ? String(value) : usd.format(n)
  }
  if (format === 'usd_range' && typeof value === 'string') {
    const parts = value.split('–').map((p) => asNumber(p.trim()))
    return parts.length === 2 && parts[0] !== null && parts[1] !== null ? `${usd.format(parts[0])} – ${usd.format(parts[1])}` : value
  }
  if (typeof value === 'number') return num.format(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined)
    return entries.length ? entries.map(([k, v]) => `${k.replace(/_/g, ' ')} ${formatValue(v)}`).join(' · ') : '—'
  }
  return String(value)
}

/** Table cells: amounts in the price-like columns read as currency. */
export function formatCell(value: unknown, column: string): string {
  if (/^(amount|price|cost|\$\/sq ft)$/i.test(column)) return formatValue(value, 'usd')
  return formatValue(value)
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/**
 * The run as markdown, to hand to Deed in the composer ("Ask Deed about this").
 * Deed then answers from these rows rather than from memory.
 */
export function runToMarkdown(run: SkillRun, maxChars = 3800): string {
  // The composer holds 4,000 characters: shed table rows before anything else.
  for (const rowCap of [10, 5, 3, 0]) {
    const md = renderRun(run, rowCap)
    if (md.length <= maxChars) return md
  }
  return renderRun(run, 0).slice(0, maxChars)
}

function renderRun(run: SkillRun, rowCap: number): string {
  const a = run.auction
  const where = [a.address, a.county ? `${a.county.replace(/_/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase())} County` : null, a.case_number ? `case ${a.case_number}` : null]
    .filter(Boolean)
    .join(', ')
  const lines: string[] = [`Skill "${run.skill.name}" results for ${where}${a.auction_date ? ` (sale ${a.auction_date})` : ''}:`, '']
  for (const r of run.results) {
    lines.push(`### ${r.title}`)
    for (const f of r.facts) {
      lines.push(`- ${f.label}: ${formatValue(f.value, f.format)}${f.detail ? ` (${f.detail})` : ''}`)
    }
    if (r.table && r.table.rows.length > 0 && rowCap > 0) {
      lines.push('', `| ${r.table.columns.map(mdEscape).join(' | ')} |`, `| ${r.table.columns.map(() => '---').join(' | ')} |`)
      for (const row of r.table.rows.slice(0, rowCap)) {
        lines.push(`| ${row.map((c, i) => mdEscape(formatCell(c, r.table!.columns[i] ?? ''))).join(' | ')} |`)
      }
      if (r.table.rows.length > rowCap) lines.push(`(${r.table.rows.length - rowCap} more rows not shown)`)
    }
    lines.push(`Source: ${r.source}.`, r.note, '')
  }
  if (run.skill.instructions) lines.push(`My playbook for this skill: ${run.skill.instructions}`, '')
  lines.push('Using only these figures, what should I check or decide next?')
  return lines.join('\n')
}

export const RUN_ERRORS: Record<string, string> = {
  auction_not_found: 'No auction matches that county and case number. Check the case number as the clerk writes it.',
  skill_not_found: 'That skill is not in your library.',
  rate_limited: 'You have run 120 skills in the last hour. Try again shortly.',
  unauthenticated: 'Sign in to run skills.',
}
