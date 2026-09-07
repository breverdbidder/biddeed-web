/**
 * Rehab-budget voice command grammar (issue #20106).
 *
 * Scoped to two hands-free actions, mirroring D4D's fixed-grammar approach
 * (lib/d4d/voice-grammar.ts): "what's the budget total" speaks the rollup
 * back, "add a line" opens the add-line row so the user can dictate the
 * description into it next. Anything else falls through to `null` — same
 * "not an error, just no match" contract as parseD4DVoiceCommand.
 */

export type ProjectsVoiceCommand = { type: 'total' } | { type: 'add' }

export interface ProjectsVoiceLanguage {
  bcp47: string
  label: string
  nativeLabel: string
  total: string[]
  add: string[]
}

export const PROJECTS_VOICE_LANGUAGES: ProjectsVoiceLanguage[] = [
  {
    bcp47: 'en-US',
    label: 'English',
    nativeLabel: 'English',
    total: ['budget total', "what's the total", 'what is the total', 'total'],
    add: ['add a line', 'add line', 'new line'],
  },
  {
    bcp47: 'es-ES',
    label: 'Spanish',
    nativeLabel: 'Español',
    total: ['total del presupuesto', 'cuál es el total', 'cual es el total', 'total'],
    add: ['agregar línea', 'agregar linea', 'nueva línea', 'nueva linea'],
  },
  {
    bcp47: 'pt-BR',
    label: 'Portuguese',
    nativeLabel: 'Português',
    total: ['total do orçamento', 'total do orcamento', 'qual é o total', 'qual e o total'],
    add: ['adicionar linha', 'nova linha'],
  },
]

export const PROJECTS_DEFAULT_LANG = 'en-US'

/** Exact BCP-47 match first, then base-language match, then English. */
export function resolveProjectsVoiceLanguage(lang: string): ProjectsVoiceLanguage {
  const norm = lang.trim().toLowerCase()
  const exact = PROJECTS_VOICE_LANGUAGES.find((l) => l.bcp47.toLowerCase() === norm)
  if (exact) return exact
  const base = norm.split('-')[0]
  const byBase = PROJECTS_VOICE_LANGUAGES.find((l) => l.bcp47.toLowerCase().split('-')[0] === base)
  return byBase ?? PROJECTS_VOICE_LANGUAGES[0]
}

function normalize(transcript: string): string {
  return transcript.trim().toLowerCase().replace(/[.!?。！？،؛]+$/g, '').trim()
}

export function parseProjectsVoiceCommand(transcript: string, lang: string): ProjectsVoiceCommand | null {
  const phrases = resolveProjectsVoiceLanguage(lang)
  const t = normalize(transcript)
  if (!t) return null
  if (phrases.total.includes(t)) return { type: 'total' }
  if (phrases.add.includes(t)) return { type: 'add' }
  return null
}
