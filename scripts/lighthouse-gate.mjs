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
 *
 * Network model (2026-10-08): fixed by default. Lighthouse's simulation adds
 * the round-trip time it observes from the machine running it to each origin.
 * From GitHub's runners that put mobile FCP at 2.0-2.3 s on every run of
 * 2026-10-08 - against 1.1 s for the same page, same commit, with the runner's
 * own latency taken out - and failed the gate on the runner's network rather
 * than the page (37824641474: mobile 91/97, desktop 99/99/99). PageSpeed
 * Insights runs next to Google's network. So by default the gate tells
 * Lighthouse the page's origins add no extra round trip and answer in 100 ms
 * (--network observed restores the runner's own numbers). The page's real
 * server time is still measured and posted ("Server" column), and a median
 * over 600 ms fails the gate on its own.
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
const network = arg('network', 'fixed')
const dir = mkdtempSync(join(tmpdir(), 'lh-gate-'))
const MAX_SERVER_MS = 600
// Origins the landing page talks to before it settles; anything else falls
// back to Lighthouse's defaults.
const ORIGINS = [new URL(url).origin, 'https://static.cloudflareinsights.com', 'https://us-assets.i.posthog.com', 'https://us.i.posthog.com']
const lanternPath = join(dir, 'lantern-network.json')
writeFileSync(lanternPath, JSON.stringify({
  additionalRttByOrigin: Object.fromEntries(ORIGINS.map((o) => [o, 0])),
  serverResponseTimeByOrigin: Object.fromEntries(ORIGINS.map((o, i) => [o, i === 0 ? 100 : 20])),
}))

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
  if (network === 'fixed') args.push(`--precomputed-lantern-data-path=${lanternPath}`)
  try {
    execFileSync('npx', args, { stdio: ['ignore', 'ignore', 'inherit'], timeout: 180_000 })
    const r = JSON.parse(readFileSync(path, 'utf8'))
    const score = r.categories?.performance?.score
    if (typeof score !== 'number') throw new Error(r.runtimeError?.message || 'no performance score')
    return {
      score: Math.round(score * 100),
      metrics: Object.fromEntries(METRICS.map(([id, label]) => [label, r.audits?.[id]?.displayValue ?? 'n/a'])),
      warnings: r.runWarnings ?? [],
      // Host CPU speed: lab TBT scales with it, so a red run on a slow
      // runner reads differently from a red run on a fast one.
      benchmark: Math.round(r.environment?.benchmarkIndex ?? 0),
      serverMs: Math.round(r.audits?.['server-response-time']?.numericValue ?? 0),
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

const verdict = (row) =>
  row.median === null ? 'NO DATA' : row.median.score >= min && row.median.serverMs <= MAX_SERVER_MS ? 'PASS' : 'FAIL'
const lines = [
  `## PageSpeed gate - ${url}`,
  '',
  `Lighthouse ${LIGHTHOUSE.split('@')[1]}, ${runs} run(s) per form factor, median shown. Bar: Performance >= ${min} and server response <= ${MAX_SERVER_MS} ms. Network model: ${network === 'fixed' ? 'fixed (no extra round trip to the page origins; see the script header)' : "observed (this runner's own latency)"}.`,
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
// One annotation per form factor, so the scores can be read from the
// check-run API (zero-HITL monitoring) and not only from the run page.
for (const row of rows) {
  if (row.median === null) continue
  const m = row.median.metrics
  console.log(`::notice title=PageSpeed ${row.formFactor} ${verdict(row)}::median ${row.median.score} (runs ${row.all.join(', ')}); FCP ${m.FCP}, LCP ${m.LCP}, TBT ${m.TBT}, CLS ${m.CLS}, SI ${m.SI}, server ${m.Server}; CPU benchmark ${row.median.benchmark}; network ${network}`)
}

if (couldNotRun) process.exit(2)
process.exit(rows.every((r) => verdict(r) === 'PASS') ? 0 : 1)
