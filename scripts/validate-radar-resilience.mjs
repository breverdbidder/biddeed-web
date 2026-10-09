#!/usr/bin/env node
/**
 * Radar resilience gate (REA teardown fixes, 2026-10-09).
 *
 * Three regressions the teardown measured live, each pinned here so a later
 * edit cannot quietly bring it back:
 *
 * 1. No WebGL, no page. `new mapboxgl.Map()` throws synchronously without
 *    WebGL; unguarded, the throw reached the route error boundary, which
 *    retried behind a spinner and never rendered an auction. Every Mapbox
 *    constructor must go through createMapSafely() (lib/map/webgl.ts).
 * 2. The calendar's CSP error. FullCalendar injects a data: @font-face that
 *    font-src refuses. lib/fullcalendar-no-icon-font.ts drops it, but only if
 *    it is imported BEFORE any @fullcalendar module in the same file.
 * 3. Duplicate summary requests. /api/auctions/summary is fetched in exactly
 *    one client place (components/shell/useAuctionCounts.ts); everything else
 *    shares that memoised promise.
 *
 * Exit 0 = clean, 1 = a finding.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const findings = []

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p)
  }
  return out
}

const files = [...walk('app'), ...walk('components'), ...walk('lib')]

for (const f of files) {
  const src = readFileSync(f, 'utf8')

  // 1. Mapbox constructors
  const re = /new\s+mapboxgl\.Map\s*\(/g
  let m
  while ((m = re.exec(src))) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1
    if (/^\s*(\*|\/\/|\/\*)/.test(src.slice(lineStart, m.index))) continue // comment
    const before = src.slice(Math.max(0, m.index - 40), m.index)
    if (!/createMapSafely\(\s*\(\)\s*=>\s*$/.test(before)) {
      const line = src.slice(0, m.index).split('\n').length
      findings.push(`${f}:${line}: new mapboxgl.Map() outside createMapSafely() - a browser without WebGL will crash this route`)
    }
  }

  // 2. FullCalendar font guard import order
  const fcImport = src.search(/^import\s[^\n]*['"]@fullcalendar\//m)
  if (fcImport !== -1) {
    const guard = src.search(/^import\s+['"]@\/lib\/fullcalendar-no-icon-font['"]/m)
    if (guard === -1 || guard > fcImport) {
      findings.push(`${f}: imports @fullcalendar without importing '@/lib/fullcalendar-no-icon-font' first - the calendar will log a font-src CSP error`)
    }
  }

  // 3. One client fetch of the summary
  if (f !== join('components', 'shell', 'useAuctionCounts.ts') && /^['"]use client['"]/.test(src.trimStart())) {
    if (/fetch\([^)]*['"`][^'"`]*\/api\/auctions\/summary/.test(src)) {
      findings.push(`${f}: fetches /api/auctions/summary directly - use loadSummaryJson() / useAuctionCounts() so the page makes one request`)
    }
  }
}

if (findings.length) {
  console.error('radar-resilience: findings')
  for (const x of findings) console.error('  - ' + x)
  process.exit(1)
}
console.log(`radar-resilience: clean - ${files.length} files scanned; Mapbox constructors guarded, calendar font guard first, one summary fetch`)
