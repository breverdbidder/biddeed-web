#!/usr/bin/env node
/**
 * Canon gate - prices and banned terms.
 *
 * Companion to scripts/palette-gate.mjs. That gate stops a session from changing
 * the colours; this one stops a session from silently changing the PRICES or
 * reintroducing a retired term. Both run before the production build, so canon is
 * a precondition of deploying rather than of reviewing (there is often no PR:
 * agent sessions push straight to main under one shared identity).
 *
 * Changing a price is a deliberate act: edit CANON_PRICES below in the same
 * commit as the copy, or this fails the deploy.
 *
 * Exit 0 = clean. Exit 1 = a finding. Exit 2 = the gate could not do its job
 * (missing file, unparseable PLANS) - never a silent pass.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const PLANS_FILE = 'components/deed-home/LandingSections.tsx'

// Ariel, 2026-09-07: Pro Plus repriced $299 -> $399 alongside the win-to-exit scope.
const CANON_PRICES = [
  ['Free', '$0'],
  ['Investor', '$99'],
  ['Pro', '$199'],
  ['Pro Plus', '$399'],
]

const BANNED = [
  [/shapira\s+max\s+bid/i, 'retired brand - write "SIGNAL$ Max Bid"'],
  [/\bodoo\b/i, 'the accounting engine is licence-restricted: never name it in customer-facing copy'],
]

const SCAN_ROOTS = ['app', 'components', 'content']
const SCAN_EXT = new Set(['.ts', '.tsx', '.md', '.mdx', '.css'])

const findings = []
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* 1. Prices */
let plans
try {
  plans = readFileSync(PLANS_FILE, 'utf8')
} catch {
  console.error(`canon-gate: cannot read ${PLANS_FILE} - the gate cannot verify prices.`)
  process.exit(2)
}

if (!/const\s+PLANS\s*:/.test(plans)) {
  console.error(`canon-gate: no "const PLANS" declaration in ${PLANS_FILE}. If the pricing array`)
  console.error('was renamed or moved, update this gate in the same commit.')
  process.exit(2)
}

for (const [name, want] of CANON_PRICES) {
  const re = new RegExp(`name:\\s*'${esc(name)}'[\\s\\S]{0,400}?price:\\s*'([^']*)'`)
  const m = plans.match(re)
  if (!m) {
    findings.push(`${PLANS_FILE}: plan "${name}" not found, or it has no price within its object literal`)
    continue
  }
  if (m[1] !== want) {
    findings.push(`${PLANS_FILE}: plan "${name}" is ${m[1]}, canon is ${want}`)
  }
}

// Catch a plan that was added or renamed rather than edited.
const allowed = new Set(CANON_PRICES.map(([, p]) => p))
const plansBlock = plans.slice(plans.indexOf('const PLANS'))
for (const m of plansBlock.matchAll(/price:\s*'(\$[\d,]+)'/g)) {
  if (!allowed.has(m[1])) {
    findings.push(`${PLANS_FILE}: price ${m[1]} is not in the canon set (${[...allowed].join(', ')})`)
  }
}

/* 2. Banned terms */
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

for (const file of SCAN_ROOTS.flatMap(walk)) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  for (const [re, why] of BANNED) {
    lines.forEach((line, i) => {
      if (re.test(line)) findings.push(`${file}:${i + 1}: ${why} - ${line.trim().slice(0, 90)}`)
    })
  }
}

/* Report */
if (findings.length) {
  console.error(`canon-gate: ${findings.length} finding(s)\n`)
  for (const f of findings) console.error('  ' + f)
  console.error('\nPrices and retired terms are canon. If a change is intended, edit')
  console.error('scripts/canon-gate.mjs in the same commit so the change is explicit.')
  process.exit(1)
}

const summary = CANON_PRICES.map(([n, p]) => `${n} ${p}`).join(' - ')
console.log(`canon-gate: clean - ${summary}`)
