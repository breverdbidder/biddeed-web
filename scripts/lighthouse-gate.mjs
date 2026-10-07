#!/usr/bin/env node
/**
 * PageSpeed gate - Ariel's benchmark: Performance >= 95 on mobile AND desktop.
 *
 * Runs Lighthouse (the engine behind Google PageSpeed Insights) N times per
 * form factor against a live URL, takes the MEDIAN run by score (Lighthouse's
 * own guidance for single-page variance), and fails when either form factor's
 * median is under the bar.
 *
 * Why this exists. 2026-10-07, PageSpeed Insights on https://biddeed.ai/
 * scored 64 mobile / 64 desktop: the homepage map loaded its 485 KiB Mapbox
 * bundle on page open and every hashed asset was served max-age=0. Nothing in
 * CI measured load performance, so a regression of that size shipped with
 * every gate green. This makes speed a measured, posted number on every
 * production deploy instead of something found by hand.
 *
 * Usage:
 *   node scripts/lighthouse-gate.mjs --url https://biddeed.ai/ --runs 3 --min 95 --out pagespeed.md
 *
 * Exit codes - deliberately never a silent pass:
 *   0  every form factor's median score >= min
 *   1  at least one form factor is under the bar (the table says which metric)
 *   2  the gate could not do its job (Lighthouse failed to produce a report)
 *
 * Lighthouse is fetched with npx at a pinned version so this repo's lockfile
 * does not change. It needs a Chrome binary: GitHub's ubuntu runners ship one,
 * and CHROME_PATH overrides it anywhere else.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const LIGHTHOUSE = 'lighthouse@13.5.0'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const url = arg('url', 'https://biddeed.ai/')
const runs = Math.max(1, Number(arg('runs', '3')))
const min = Number(arg('min', '95'))
const out = arg('out', 'pagespeed.md')
const dir = mkdtempSync(join(tmpdir(), 'lh-gate-'))

const METRICS = [
  ['first-contentful-paint', 'FCP'],
  ['largest-contentful-paint', 'LCP'],
  ['total-blocking-time', 'TBT'],
  ['cumulative-layout-shift', 'CLS'],
  ['speed-index', 'SI'],
  ['server-response-time', 'Server'],
]

function runOnce(formFactor, i) {
  const path = join(dir, `${formFactor}-${i}.json`)
  const args = [
    '-y', LIGHTHOUSE, url,
    '--only-categories=performance',
    '--output=json', `--output-path=${path}`,
    '--quiet',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
  ]
  if (formFactor === 'desktop') args.push('--preset=desktop')
  try {
    execFileSync('npx', args, { stdio: ['ignore', 'ignore', 'inherit'], timeout: 180_000 })
    const r = JSON.parse(readFileSync(path, 'utf8'))
    const score = r.categories?.performance?.score
    if (typeof score !== 'number') throw new Error(r.runtimeError?.message || 'no performance score')
    return {
      score: Math.round(score * 100),
      metrics: Object.fromEntries(METRICS.map(([id, label]) => [label, r.audits?.[id]?.displayValue ?? 'n/a'])),
      warnings: r.runWarnings ?? [],
    }
  } catch (e) {
    console.error(`lighthouse ${formFactor} run ${i + 1} failed: ${e.message}`)
    return null
  }
}

const rows = []
let couldNotRun = false
for (const formFactor of ['mobile', 'desktop']) {
  const results = []
  for (let i = 0; i < runs; i++) {
    const r = runOnce(formFactor, i)
    if (r) results.push(r)
    console.log(`${formFactor} run ${i + 1}/${runs}: ${r ? r.score : 'FAILED'}`)
  }
  if (results.length === 0) {
    couldNotRun = true
    rows.push({ formFactor, median: null })
    continue
  }
  results.sort((a, b) => a.score - b.score)
  const median = results[Math.floor((results.length - 1) / 2)]
  rows.push({ formFactor, median, all: results.map((r) => r.score) })
}

const verdict = (row) => (row.median === null ? 'NO DATA' : row.median.score >= min ? 'PASS' : 'FAIL')
const lines = [
  `## PageSpeed gate - ${url}`,
  '',
  `Lighthouse ${LIGHTHOUSE.split('@')[1]}, ${runs} run(s) per form factor, median shown. Bar: Performance >= ${min}.`,
  '',
  `| Form factor | Score | Runs | ${METRICS.map(([, l]) => l).join(' | ')} | Verdict |`,
  `|---|---|---|${METRICS.map(() => '---').join('|')}|---|`,
  ...rows.map((row) =>
    row.median === null
      ? `| ${row.formFactor} | - | - | ${METRICS.map(() => '-').join(' | ')} | NO DATA |`
      : `| ${row.formFactor} | **${row.median.score}** | ${row.all.join(', ')} | ${METRICS.map(([, l]) => row.median.metrics[l]).join(' | ')} | ${verdict(row)} |`
  ),
  '',
]
const warnings = rows.flatMap((r) => r.median?.warnings ?? [])
if (warnings.length) lines.push('Lighthouse warnings:', ...warnings.map((w) => `- ${w}`), '')
writeFileSync(out, lines.join('\n'))
console.log(lines.join('\n'))

if (couldNotRun) process.exit(2)
process.exit(rows.every((r) => verdict(r) === 'PASS') ? 0 : 1)
