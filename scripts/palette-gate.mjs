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
/*
 * Canon-values check (added 2026-09-06 after 124ffc1 pushed cream/terracotta
 * straight to main and passed this gate — the literal rule only asked WHERE a
 * colour lives, never WHICH colour). The light palette is exactly the seven
 * Ariel set on 2026-09-04; the two token files may not carry any other light
 * value. Dark-mode values (html[data-theme='dark'] / DARK) are the same family
 * lifted and are listed too. Anything else fails, in CI and in the deploy.
 */
const CANON_LIGHT = ['#f5f0e8', '#fbfaf7', '#f8d4c5', '#1f1b16', '#766f67', '#ddd5c9', '#c15f3c', '#a94d30', '#ede3d7', '#0a2540']
const CANON_DARK = ['#0b1119', '#111b27', '#1b2737', '#ededed', '#9eb2c7', '#24344c', '#1a90ff', '#4da6ff']
const CANON = new Set([...CANON_LIGHT, ...CANON_DARK])
const tokenFindings = []
for (const rel of ALLOW) {
  let text
  try { text = readFileSync(rel, 'utf8') } catch { continue }
  // Comments may name off-palette values (the vendor defaults they replace); only code counts.
  text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      if (!CANON.has(m[0].toLowerCase())) tokenFindings.push({ rel, line: i + 1, hit: m[0] })
    }
    // shadcn HSL triples: only the canon renderings may appear on the semantic tokens
    for (const m of line.matchAll(/^\s*--(?:background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring|primary-hover|chart-\d|sidebar-[a-z-]+)(?:-foreground)?:\s*([\d.]+ [\d.]+% [\d.]+%)/g)) {
      const hsl = m[1]
      const ok = [
        '39 33% 94%', '40 33% 98%', '30 17% 10%', '36 23% 83%', '30 10% 32%', '14 54% 49%', '14 55% 43%',
        '213 39% 7%', '214 39% 11%', '214 35% 16%', '0 0% 93%', '211 27% 70%', '216 35% 22%', '209 100% 55%',
        '210 73% 15%',
      ].includes(hsl)
      if (!ok) tokenFindings.push({ rel, line: i + 1, hit: `hsl ${hsl}` })
    }
  })
}
if (tokenFindings.length) {
  console.error(`palette-gate: ${tokenFindings.length} value(s) in the token files that are NOT the canon palette (light: ${CANON_LIGHT.join(' ')})\n`)
  for (const f of tokenFindings) console.error(`  ${f.rel}:${f.line}  ${f.hit}`)
  console.error('\nThe token files must use the deployed WinnerDataAI child-brand light palette or explicit dark palette; update the canon and tokens together when the design system changes.')
  process.exit(1)
}

console.log('palette-gate: 0 colour literals outside the token files; token files carry only the canon values')
