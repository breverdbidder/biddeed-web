#!/usr/bin/env node
/**
 * Source-level palette gate (PARITY_PRD.md §4 change control, biddeed-web side).
 *
 * Fails when a colour literal enters the app outside the two token files:
 *   1. hex literals (#rrggbb / #rgb) in app/, components/, lib/ (.ts/.tsx/.css)
 *   2. Tailwind arbitrary-value colour classes  bg-[#…] / text-[var(--x,#…)]
 *   3. raw Tailwind palette classes  text-red-500, bg-slate-800, border-amber-400 …
 *
 * Allowed sources of colour: app/globals.css (the token layer) and
 * lib/design-tokens.ts (its JS mirror for third-party surfaces such as Clerk).
 *
 * Usage: node scripts/palette-gate.mjs   (exit 1 on any finding)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['app', 'components', 'lib']
const ALLOW = new Set(['app/globals.css', 'lib/design-tokens.ts'])
const EXT = /\.(tsx?|css)$/
const TW_FAMILIES =
  'red|amber|orange|yellow|green|emerald|gray|zinc|neutral|stone|slate|blue|indigo|violet|purple|pink|rose|cyan|teal|sky|lime|fuchsia'

const RULES = [
  { name: 'hex literal', re: /(?<=[:'"`(,\s])#(?:[0-9a-fA-F]{6}\b(?![0-9a-zA-Z-])|[0-9a-fA-F]{3}(?=[;'"`)\s,]))(?<!\s#\d{3})/g },
  { name: 'arbitrary colour class', re: /(?:bg|text|border|from|to|via|ring|ring-offset|fill|stroke|shadow|outline|decoration|placeholder)-\[(?:var\([^)]*#[^)]*\)|#[0-9a-fA-F]{3,8})\]/g },
  { name: 'raw Tailwind colour class', re: new RegExp(`(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border|from|to|via|ring|ring-offset|fill|stroke|shadow|outline|decoration|placeholder|divide|accent|caret)-(?:${TW_FAMILIES})-\\d{2,3}(?:/\\d{1,3})?(?![\\w-])`, 'g') },
]

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else if (EXT.test(name)) yield p
  }
}

const findings = []
for (const root of ROOTS) {
  let entries
  try { entries = [...walk(root)] } catch { continue }
  for (const file of entries) {
    const rel = relative('.', file).replaceAll('\\', '/')
    if (ALLOW.has(rel)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        for (const m of line.matchAll(rule.re)) findings.push({ rel, line: i + 1, rule: rule.name, hit: m[0] })
      }
    })
  }
}

if (findings.length) {
  console.error(`palette-gate: ${findings.length} colour literal(s) outside app/globals.css + lib/design-tokens.ts\n`)
  for (const f of findings) console.error(`  ${f.rel}:${f.line}  [${f.rule}]  ${f.hit}`)
  console.error('\nUse the token classes (bg-background, text-foreground, text-muted-foreground, bg-primary, border-border, bg-secondary …) or the lib/design-tokens.ts mirror.')
  process.exit(1)
}
console.log('palette-gate: 0 colour literals outside the token files')
