#!/usr/bin/env node
// Measures WCAG 2.2 contrast: control borders (3:1, SC 1.4.11) and text (4.5:1 normal / 3:1 large, SC 1.4.3)
// against LIVE rendered Chromium, for issue #20179 (G-CONTRAST).
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'https://biddeed.ai'
const outDir = process.env.OUT_DIR || path.resolve('artifacts/contrast-audit')
fs.mkdirSync(outDir, { recursive: true })

const routes = ['/', '/pricing', '/subscribe', '/buy-report', '/radar', '/d4d', '/projects', '/counties']
const viewports = [
  { name: '320', width: 320, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
]

function measure() {
  function luminance(rgb) {
    const values = rgb.map((value) => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
  }
  function parse(value) {
    if (!value) return null
    const match = value.match(/rgba?\(([^)]+)\)/)
    if (!match) return null
    const parts = match[1].split(',').map(Number)
    return { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 }
  }
  function ratio(rgbA, rgbB) {
    const a = luminance(rgbA); const b = luminance(rgbB)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }
  // Per the issue's stated methodology: "walk up parents for the first
  // non-transparent backgroundColor" — the first ancestor (or self) whose
  // backgroundColor has alpha > 0, using its RGB channels as-is (no alpha
  // compositing onto whatever sits behind it). This intentionally matches
  // the live measurement being reproduced, not a fully alpha-correct render.
  function firstNonTransparentBg(element) {
    let current = element
    while (current) {
      const styles = getComputedStyle(current)
      const parsed = parse(styles.backgroundColor)
      if (parsed && parsed.alpha > 0) return parsed.rgb
      current = current.parentElement
    }
    return [255, 255, 255]
  }

  const badText = []
  const badBorders = []

  // --- Text contrast sweep (SC 1.4.3) ---
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = node.textContent.trim()
    if (!text) continue
    const element = node.parentElement
    if (!element) continue
    const styles = getComputedStyle(element)
    if (styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) === 0) continue
    const foreground = parse(styles.color)
    if (!foreground || foreground.alpha === 0) continue
    const bgRgb = firstNonTransparentBg(element)
    const fgRgb = foreground.rgb
    const r = ratio(fgRgb, bgRgb)
    const fontSize = Number.parseFloat(styles.fontSize)
    const fontWeight = Number.parseInt(styles.fontWeight, 10) || 400
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700)
    const threshold = isLarge ? 3 : 4.5
    if (r < threshold) {
      badText.push({
        route: '', viewport: '', tag: element.tagName.toLowerCase(),
        text: text.slice(0, 60), ratio: Number(r.toFixed(2)), threshold,
        fontSize: Number(fontSize.toFixed(1)), fontWeight,
        color: `rgb(${foreground.rgb.join(',')})`, bg: `rgb(${bgRgb.map((v) => Math.round(v)).join(',')})`,
        selector: element.className ? `${element.tagName.toLowerCase()}.${String(element.className).split(' ').slice(0, 2).join('.')}` : element.tagName.toLowerCase(),
      })
    }
  }

  // --- Control border contrast sweep (SC 1.4.11), 3:1 ---
  const controlSelectors = 'button, [role="button"], input, select, textarea, a.btn, [class*="btn"]'
  for (const element of document.querySelectorAll(controlSelectors)) {
    const styles = getComputedStyle(element)
    if (styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) === 0) continue
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const widths = [styles.borderTopWidth, styles.borderRightWidth, styles.borderBottomWidth, styles.borderLeftWidth].map(parseFloat)
    if (widths.every((w) => !w)) continue // no visible border
    const borderColor = parse(styles.borderTopColor)
    if (!borderColor || borderColor.alpha === 0) continue
    const bgRgb = firstNonTransparentBg(element)
    const borderRgb = borderColor.rgb
    const r = ratio(borderRgb, bgRgb)
    if (r < 3) {
      badBorders.push({
        route: '', viewport: '', tag: element.tagName.toLowerCase(),
        text: (element.innerText || element.value || '').trim().slice(0, 40),
        ratio: Number(r.toFixed(2)),
        border: `rgb(${borderColor.rgb.join(',')})`, bg: `rgb(${bgRgb.map((v) => Math.round(v)).join(',')})`,
        selector: element.className ? `${element.tagName.toLowerCase()}.${String(element.className).split(' ').slice(0, 2).join('.')}` : element.tagName.toLowerCase(),
      })
    }
  }

  return { badText, badBorders }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] })
const results = []
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (biddeed-contrast-audit)' })
  for (const route of routes) {
    const page = await context.newPage()
    let status = 0; let error = ''
    try {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 30_000 })
      status = response?.status() || 0
      await page.waitForTimeout(1500)
      const audit = await page.evaluate(`(${measure.toString()})()`)
      for (const item of audit.badText) { item.route = route; item.viewport = viewport.name }
      for (const item of audit.badBorders) { item.route = route; item.viewport = viewport.name }
      results.push({ route, viewport: viewport.name, width: viewport.width, status, badText: audit.badText, badBorders: audit.badBorders })
    } catch (err) {
      error = String(err).slice(0, 300)
      results.push({ route, viewport: viewport.name, width: viewport.width, status, error, badText: [], badBorders: [] })
    } finally { await page.close() }
  }
  await context.close()
}
await browser.close()

const allBadText = results.flatMap((r) => r.badText)
const allBadBorders = results.flatMap((r) => r.badBorders)
const payload = {
  base, generatedAt: new Date().toISOString(),
  totals: { badText: allBadText.length, badBorders: allBadBorders.length },
  badText: allBadText, badBorders: allBadBorders,
  errors: results.filter((r) => r.error).map((r) => ({ route: r.route, viewport: r.viewport, error: r.error })),
}
fs.writeFileSync(path.join(outDir, 'contrast-audit.json'), JSON.stringify(payload, null, 2))
console.log(JSON.stringify({ badTextCount: allBadText.length, badBorderCount: allBadBorders.length, errors: payload.errors, outDir }, null, 2))
