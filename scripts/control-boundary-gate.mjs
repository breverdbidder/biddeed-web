#!/usr/bin/env node
/**
 * Control-boundary gate - every form control must have a visible resting edge.
 *
 * Companion to scripts/palette-gate.mjs and scripts/canon-gate.mjs. Those two
 * stop a session from changing colours or prices; this one stops a session
 * from shipping a control (input/select/textarea, or a card/button acting as
 * one) with no visible boundary until focus - the dark-to-light conversion
 * bug from #20105/#20109 where a field read as plain text until you touched it.
 *
 * WCAG 2.1 SC 1.4.11 (Non-text Contrast) requires >=3:1 contrast for the
 * boundary of a UI component against its background. On this palette:
 *   --border  #D7E3F1 on white  ~1.3:1  -- CONTAINER edges only (cards,
 *             dividers). Nowhere near 3:1. Fine to look faint on purpose.
 *   --input   #0A2540 on white  15.54:1 -- the CONTROL boundary. Every
 *             <input>/<select>/<textarea>, and every clickable/toggleable
 *             card acting as a control, must use border-input at rest.
 * Do NOT "fix" a border-input back to border-border/#D7E3F1 because it looks
 * more subtle - that subtlety is exactly the bug this gate exists to catch.
 * Focus state is unchanged brand blue (#005EB8 / hsl(var(--ring))).
 *
 * Usage: node scripts/control-boundary-gate.mjs
 * Exit 0 = clean. Exit 1 = a finding. Exit 2 = the gate could not do its job
 * (scan roots missing, or zero control elements found at all) - never a
 * silent pass.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SCAN_ROOTS = ['app', 'components', 'lib']
const SCAN_EXT = new Set(['.ts', '.tsx', '.css'])

const findings = []

function walk(dir) {
  let out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) out = out.concat(walk(p))
    else if (SCAN_EXT.has(extname(p))) out.push(p)
  }
  return out
}

/* 0. The gate must actually have something to scan, or it can't do its job. */
let files = []
for (const root of SCAN_ROOTS) {
  let st
  try {
    st = statSync(root)
  } catch {
    console.error(`control-boundary-gate: scan root "${root}" is missing - cannot verify control boundaries.`)
    process.exit(2)
  }
  if (!st.isDirectory()) {
    console.error(`control-boundary-gate: scan root "${root}" is not a directory - cannot verify control boundaries.`)
    process.exit(2)
  }
  files = files.concat(walk(root))
}

/* 1. Literal white/near-white border on a light surface - the original bug
 * pattern (border:1px solid #ffffff / #fff, or Tailwind border-white). */
const LITERAL_WHITE_RE = /border(?:-[trbl]|-[xy])?-white\b|border\s*:\s*1px\s+solid\s+#fff(?:fff)?\b/gi

/* 2. A form-control element (<input>/<select>/<textarea>) whose own
 * className has no border at all, or explicitly kills it. We scan each
 * element's opening tag by finding "<tagName" and then walking forward,
 * tracking {}/()/[] nesting depth, until the closing `>` of the tag itself -
 * a plain [^>]* regex breaks on JSX event handlers like `onChange={(e) =>
 * ...}`, whose arrow-function `>` closes the regex early before className is
 * ever reached. */
// Case-sensitive and \b-bounded so a custom wrapper component like <Input>
// or <SidebarInput> (PascalCase, from components/ui/input.tsx, which itself
// is checked directly below) is never treated as a raw HTML element - its
// composed className can only ADD to the base classes via cn(), never
// silently drop the border the base component already carries.
const CONTROL_OPEN_RE = /<(input|select|textarea)\b/g
const CLASS_ATTR_RE = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{cn\(([\s\S]*?)\)\}|\{(\w+)\}|\{(\w+)\s*\+[^}]*\})/

function extractTag(text, startIdx) {
  let depth = 0
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i]
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    else if (c === '>' && depth <= 0) return text.slice(startIdx, i + 1)
  }
  return text.slice(startIdx, Math.min(startIdx + 2000, text.length))
}
const NO_BORDER_AT_REST = /\bborder-none\b|\bborder-transparent\b(?!\s|["'`]*\s*:)/
const HAS_BORDER_INPUT = /\bborder-input\b/
const HAS_ANY_BORDER_CLASS = /\bborder(?:-[trblxy])?\b(?!-none|-transparent)/

let controlsScanned = 0

for (const file of files) {
  const rel = file.replaceAll('\\', '/')
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')

  // Rule 1: literal white border.
  lines.forEach((line, i) => {
    for (const m of line.matchAll(LITERAL_WHITE_RE)) {
      findings.push({ rel, line: i + 1, rule: 'literal white/near-white border on a light surface', hit: m[0] })
    }
  })

  if (extname(file) === '.css') continue

  // A className of the form {FIELD} or {FIELD + bad('x')} refers to a local
  // `const FIELD = '...'` string built once and reused (the exact pattern
  // this codebase uses in components/support/SupportForm.tsx,
  // TicketLookup.tsx, and the selectClass const in AuctionFilters.tsx) -
  // resolve the identifier's own literal so it is checked once, correctly,
  // instead of flagged as "no className" at every call site.
  const localConsts = new Map()
  for (const cm of text.matchAll(/const\s+(\w+)\s*=\s*\n?\s*'([^']*)'/g)) {
    localConsts.set(cm[1], cm[2])
  }

  // Rule 2: bare form controls with no resting boundary.
  for (const m of text.matchAll(CONTROL_OPEN_RE)) {
    const tagName = m[1]
    const tag = extractTag(text, m.index)
    // type="hidden" / type="checkbox" carry no visible box border in this
    // codebase's convention (accent-color renders the checkbox itself); skip.
    // type="file" pickers are triggered via a hidden native input styled
    // "hidden" and a visible custom trigger button elsewhere - the native
    // input itself is never rendered, so it is exempt too.
    if (/type\s*=\s*["'](?:hidden|checkbox|file)["']/i.test(tag)) continue
    // A honeypot field (tabIndex={-1}, off-screen by construction) is not a
    // visible control and is exempt from the boundary requirement.
    if (/tabIndex\s*=\s*\{?-1\}?/.test(tag)) continue

    controlsScanned++
    const classMatch = tag.match(CLASS_ATTR_RE)
    let className = classMatch ? classMatch[1] || classMatch[2] || classMatch[3] || classMatch[4] || '' : ''
    const identRef = classMatch ? classMatch[5] || classMatch[6] : undefined
    if (!className && identRef && localConsts.has(identRef)) className = localConsts.get(identRef)
    const lineNo = text.slice(0, m.index).split('\n').length

    if (!className) {
      findings.push({ rel, line: lineNo, rule: `<${tagName}> has no className - no resting border possible`, hit: tag.slice(0, 80) })
      continue
    }
    // The wrapper-carries-the-border pattern: a control styled
    // bg-transparent with no border of its own, nested inside an ancestor
    // element that IS the visible edge (e.g. DiscoveryPage.tsx's search
    // pill, DeedComposer.tsx's message box). This is only exempted when the
    // SAME FILE demonstrably carries border-input somewhere else (the
    // wrapper) - otherwise a borderless control with no bordered ancestor at
    // all would silently pass, which is exactly the bug class this gate
    // exists to catch. No wrapper evidence in the file = still a finding.
    if (
      /\bbg-transparent\b/.test(className) &&
      !HAS_ANY_BORDER_CLASS.test(className) &&
      !NO_BORDER_AT_REST.test(className) &&
      HAS_BORDER_INPUT.test(text)
    ) {
      continue
    }
    if (NO_BORDER_AT_REST.test(className)) {
      findings.push({ rel, line: lineNo, rule: `<${tagName}> uses border-none/border-transparent at rest`, hit: className })
      continue
    }
    if (!HAS_ANY_BORDER_CLASS.test(className)) {
      findings.push({ rel, line: lineNo, rule: `<${tagName}> has no border-* class at rest`, hit: className })
      continue
    }
    if (!HAS_BORDER_INPUT.test(className) && /\bborder-border\b/.test(className)) {
      findings.push({ rel, line: lineNo, rule: `<${tagName}> uses border-border (container token, ~1.3:1) instead of border-input (control token, 15.54:1)`, hit: className })
    }
  }
}

if (controlsScanned === 0) {
  console.error('control-boundary-gate: zero <input>/<select>/<textarea> elements found under app/, components/, lib/ - the scan pattern or app structure changed. Cannot verify control boundaries.')
  process.exit(2)
}

if (findings.length) {
  console.error(`control-boundary-gate: ${findings.length} finding(s) across ${controlsScanned} controls scanned\n`)
  for (const f of findings) console.error(`  ${f.rel}:${f.line}  [${f.rule}]  ${f.hit}`)
  console.error('\nEvery form control needs a visible resting boundary: border-input (#0A2540,')
  console.error('15.54:1), not border-border (#D7E3F1, ~1.3:1 - a container-edge token that')
  console.error('reads as WCAG 2.1 SC 1.4.11-failing on a control), and never border-none /')
  console.error('border-transparent / no border class at all.')
  process.exit(1)
}

console.log(`control-boundary-gate: clean - ${controlsScanned} controls scanned, all have a visible border-input resting boundary; no literal white borders found`)
