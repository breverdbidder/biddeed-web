import { SKILL_TOOLS, type SkillTool } from './shared'

/**
 * SKILL.md for a Deed skill: YAML-style frontmatter, then the instructions.
 *
 *   ---
 *   name: Pre-bid check
 *   description: Liens, max-bid facts and comps before I register to bid.
 *   tools: [lien_survival, max_bid, comps]
 *   ---
 *   Stop if any lien SURVIVES. Otherwise compare the plaintiff max bid with
 *   the comps median.
 *
 * `tools` may also be a list (`- lien_survival` lines). Only the six Deed
 * tools are allowed; the database checks the same list again on save.
 */

export interface ParsedSkill {
  name: string
  description: string
  tools: SkillTool[]
  instructions: string
}

export type ParseResult = { ok: true; skill: ParsedSkill } | { ok: false; error: string }

export const SKILL_TEMPLATE = `---
name: Pre-bid check
description: Liens, max-bid facts and comps before I register to bid.
tools: [lien_survival, max_bid, comps]
---
Stop if any lien is called SURVIVES and I would take title subject to it.
Otherwise compare the plaintiff's max bid with the comps median and tell me
how much room there is after the repair estimate.
`

const MAX_MD = 12000

function unquote(s: string): string {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1).trim()
  return t
}

export function parseSkillMd(md: string): ParseResult {
  if (typeof md !== 'string' || md.trim() === '') return { ok: false, error: 'Paste a SKILL.md with a name, a description and tools.' }
  if (md.length > MAX_MD) return { ok: false, error: `A SKILL.md can be at most ${MAX_MD.toLocaleString('en-US')} characters.` }
  const text = md.replace(/\r\n?/g, '\n').trimStart()
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) return { ok: false, error: 'Start the file with a frontmatter block between two lines of ---.' }

  const fields: Record<string, string> = {}
  const listItems: Record<string, string[]> = {}
  let currentList: string | null = null
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim() || line.trim().startsWith('#')) continue
    const item = /^\s*-\s+(.+)$/.exec(line)
    if (item && currentList) {
      listItems[currentList].push(unquote(item[1]))
      continue
    }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!kv) return { ok: false, error: `Could not read this frontmatter line: "${line.trim().slice(0, 60)}"` }
    const key = kv[1].toLowerCase()
    const value = kv[2]
    if (value.trim() === '') {
      currentList = key
      listItems[key] = []
    } else {
      currentList = null
      fields[key] = value
    }
  }

  const name = unquote(fields.name ?? '')
  const description = unquote(fields.description ?? '')
  let toolsRaw: string[] = listItems.tools ?? []
  if (fields.tools !== undefined) {
    const inline = fields.tools.trim().replace(/^\[/, '').replace(/\]$/, '')
    toolsRaw = inline.split(',').map(unquote).filter(Boolean)
  }
  const tools = Array.from(new Set(toolsRaw.map((t) => t.trim().toLowerCase().replace(/-/g, '_'))))

  if (name.length < 2 || name.length > 60) return { ok: false, error: 'Give the skill a name of 2 to 60 characters.' }
  if (!/[A-Za-z0-9]/.test(name)) return { ok: false, error: 'The name needs at least one letter or number.' }
  if (description.length < 4 || description.length > 280) return { ok: false, error: 'Give the skill a description of 4 to 280 characters.' }
  if (tools.length === 0) return { ok: false, error: `List at least one tool: ${SKILL_TOOLS.join(', ')}.` }
  if (tools.length > 6) return { ok: false, error: 'A skill can use at most 6 tools.' }
  const unknown = tools.filter((t) => !(SKILL_TOOLS as string[]).includes(t))
  if (unknown.length) return { ok: false, error: `Unknown tool ${unknown.map((t) => `"${t}"`).join(', ')}. Use: ${SKILL_TOOLS.join(', ')}.` }

  const instructions = m[2].trim()
  if (instructions.length > 8000) return { ok: false, error: 'Instructions can be at most 8,000 characters.' }
  return { ok: true, skill: { name, description, tools: tools as SkillTool[], instructions } }
}
