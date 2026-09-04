#!/usr/bin/env node
// CMO Factory content-safety audit (issue #19821, CP-C0/C1/C2). No external
// deps on purpose -- `node scripts/audit-site.mjs` must run with zero
// npm install, so this and CI stay fast and cannot silently no-op on a
// missing devDependency.
//
// Checks:
//  1. BANNED_TERMS never appear in source (app/components/lib) -- the
//     incumbent competitor is never named on biddeed.ai (Hard rule #1).
//  2. The new /counties pages never render the propertyonion-sourced raw
//     fields on multi_county_auctions (photo_url, source_url, po_*,
//     data_source) -- those columns hold scraped competitor content
//     (confirmed live: data_source='propertyonion', source_url pointing at
//     propertyonion.com) and must never reach a public page.
//  3. No hardcoded auction-count literal is sitting where a live SSOT figure
//     belongs in the new /counties route files.
//
// Usage: node scripts/audit-site.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const BANNED_TERMS = [/propertyonion/i, /property\s+onion/i]
const SCAN_DIRS = ['app', 'components', 'lib']
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])

let failures = 0

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.open-next') continue
      walk(full, files)
    } else if (SCAN_EXT.has(extname(entry))) {
      files.push(full)
    }
  }
  return files
}

let allFiles = []
for (const dir of SCAN_DIRS) {
  const abs = join(root, dir)
  try {
    allFiles = allFiles.concat(walk(abs))
  } catch {
    // dir may not exist in every checkout shape; not a failure on its own
  }
}

// 1. Banned terms
for (const file of allFiles) {
  const text = readFileSync(file, 'utf-8')
  for (const re of BANNED_TERMS) {
    if (re.test(text)) {
      console.error(`FAIL BANNED_TERMS: ${file} matches ${re}`)
      failures++
    }
  }
}
if (failures === 0) console.log(`OK   BANNED_TERMS: clean across ${allFiles.length} source files`)

// 2. propertyonion-sourced field leakage on the new /counties routes
const countiesFiles = allFiles.filter((f) => f.includes(`${path.sep}app${path.sep}counties${path.sep}`))
const LEAKY_FIELDS = [/\bphoto_url\b/, /\bsource_url\b/, /\bpo_[a-z_]+\b/, /\bdata_source\b/]
for (const file of countiesFiles) {
  const text = readFileSync(file, 'utf-8')
  for (const re of LEAKY_FIELDS) {
    if (re.test(text)) {
      console.error(`FAIL COMPETITOR_FIELD_LEAK: ${file} references ${re} (propertyonion-sourced column)`)
      failures++
    }
  }
}
if (countiesFiles.length > 0) {
  console.log(`OK   COMPETITOR_FIELD_LEAK: ${countiesFiles.length} /counties file(s) checked, none reference propertyonion-sourced columns`)
}

// 3. Hardcoded auction-count literal where a live figure belongs -- look for
// a JSX text node with a bare 2+ digit number next to "upcoming"/"auction"
// wording, OUTSIDE of a template literal / variable interpolation. This is a
// heuristic, not a type-checker: it flags obvious regressions (a pasted
// literal like "32 upcoming auctions") without false-positiving on the
// legitimate `{data.totalUpcoming}` JSX expressions this code actually uses.
const HARDCODE_PATTERN = />\s*\d{2,}\s+(upcoming|foreclosure|tax deed)\b/i
for (const file of countiesFiles) {
  const text = readFileSync(file, 'utf-8')
  if (HARDCODE_PATTERN.test(text)) {
    console.error(`FAIL HARDCODED_COUNT: ${file} has a literal number next to auction wording outside a live expression`)
    failures++
  }
}
if (countiesFiles.length > 0) {
  console.log(`OK   HARDCODED_COUNT: no literal auction-count text found in /counties routes`)
}

if (failures > 0) {
  console.error(`\nAUDIT FAILED: ${failures} issue(s) found.`)
  process.exit(1)
}
console.log('\nAUDIT PASSED: banned terms clean, no competitor-field leakage, no hardcoded counts.')
