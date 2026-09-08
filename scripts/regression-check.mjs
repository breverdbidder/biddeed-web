#!/usr/bin/env node
// Confirms the "ALREADY PASSING" list in issue #20179 didn't regress:
// horizontal overflow, tap targets < 24px at 390px, off-canon hexes.
import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'https://biddeed.ai'
const routes = ['/', '/pricing', '/subscribe', '/buy-report', '/radar', '/d4d', '/projects', '/counties']
const viewports = [
  { name: '320', width: 320, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
]
function sweep() {
  const CANON = new Set(['#ffffff', '#e6f0fa', '#1a1a1a', '#0a2540', '#d7e3f1', '#005eb8', '#004a92'])
  const width = innerWidth
  // Standard reflow check (WCAG 1.4.10): does the document itself scroll
  // horizontally, not "does any individual element's box extend past the
  // viewport" (that also flags off-canvas panels, translated drawers, etc).
  const overflow = document.documentElement.scrollWidth > width + 2 ? 1 : 0
  const hexes = new Set()
  function toHex(rgb) {
    const m = rgb.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const parts = m[1].split(',').map(Number)
    if (parts[3] === 0) return null
    return '#' + parts.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  }
  for (const el of document.querySelectorAll('body *')) {
    const styles = getComputedStyle(el)
    if (styles.display === 'none' || styles.visibility === 'hidden') continue
    for (const prop of [styles.color, styles.backgroundColor, styles.borderTopColor]) {
      const hex = toHex(prop)
      if (hex) hexes.add(hex)
    }
  }
  let smallTap = 0
  if (width <= 400) {
    for (const el of document.querySelectorAll('a, button, [role="button"], input, select')) {
      const styles = getComputedStyle(el)
      if (styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) === 0) continue
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      if (rect.right < 0 || rect.bottom < 0 || rect.left > width) continue // off-canvas, not on screen
      const text = (el.innerText || el.value || '').trim()
      if ((rect.width < 24 || rect.height < 24) && (text || el.getAttribute('aria-label'))) smallTap++
    }
  }
  return { overflow, smallTap, offCanon: [...hexes].filter((h) => !CANON.has(h)) }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] })
const results = []
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, ignoreHTTPSErrors: true })
  for (const route of routes) {
    const page = await context.newPage()
    try {
      await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 30_000 })
      await page.waitForTimeout(1200)
      const r = await page.evaluate(`(${sweep.toString()})()`)
      results.push({ route, viewport: viewport.name, ...r })
    } catch (err) {
      results.push({ route, viewport: viewport.name, error: String(err).slice(0, 200) })
    } finally { await page.close() }
  }
  await context.close()
}
await browser.close()

const totalOverflow = results.reduce((s, r) => s + (r.overflow || 0), 0)
const totalSmallTap = results.reduce((s, r) => s + (r.smallTap || 0), 0)
const allOffCanon = [...new Set(results.flatMap((r) => r.offCanon || []))]
console.log(JSON.stringify({ totalOverflow, totalSmallTap390: totalSmallTap, offCanonHexes: allOffCanon, errors: results.filter((r) => r.error) }, null, 2))
console.log('--- overflow by route ---')
console.log(JSON.stringify(results.filter((r) => r.overflow).map((r) => `${r.route} @ ${r.viewport}`), null, 2))
console.log('--- smallTap by route (390 only) ---')
console.log(JSON.stringify(results.filter((r) => r.viewport === '390').map((r) => `${r.route}: ${r.smallTap}`), null, 2))
console.log('--- offCanon by route ---')
console.log(JSON.stringify(results.filter((r) => (r.offCanon || []).length).map((r) => `${r.route} @ ${r.viewport}: ${r.offCanon.join(',')}`), null, 2))
