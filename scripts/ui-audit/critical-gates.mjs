#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'https://biddeed.ai'
const outDir = process.env.OUT_DIR || path.resolve('artifacts/critical-ui-gates')
fs.mkdirSync(outDir, { recursive: true })
const routes = ['/', '/radar', '/radar?view=map', '/radar?view=calendar', '/discover', '/auctions', '/sign-in', '/sign-up', '/buy-report']
const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]
const canon = new Set(['#ffffff', '#e6f0fa', '#1a1a1a', '#0a2540', '#d7e3f1', '#005eb8', '#004a92'])
const fonts = new Set(['Inter', 'Inter Fallback', 'Source Serif 4', 'Source Serif 4 Fallback', 'JetBrains Mono', 'system-ui', 'serif', 'sans-serif', 'monospace', 'Iowan Old Style', 'ui-monospace', 'Segoe UI Emoji'])

const sweep = () => {
  function luminance(rgb) {
    const values = rgb.map((value) => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
  }
  function parse(value) { const match = value.match(/rgba?\(([^)]+)\)/); if (!match) return null; const parts = match[1].split(',').map(Number); return { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 } }
  function hex(rgb) { return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}` }
  function bg(element) { let current = element; while (current) { const styles = getComputedStyle(current); const parsed = parse(styles.backgroundColor); if (parsed && parsed.alpha > 0.5) return parsed.rgb; current = current.parentElement } return [255, 255, 255] }
  const badContrast = []
  const colors = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = node.textContent.trim()
    if (!text) continue
    const element = node.parentElement
    const styles = getComputedStyle(element)
    if (styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) === 0) continue
    const foreground = parse(styles.color)
    if (!foreground || foreground.alpha === 0) continue
    const background = bg(element)
    const ratio = (Math.max(luminance(foreground.rgb), luminance(background)) + 0.05) / (Math.min(luminance(foreground.rgb), luminance(background)) + 0.05)
    const fg = hex(foreground.rgb); const bgHex = hex(background)
    colors.add(fg); colors.add(bgHex)
    if (ratio < 4.5) badContrast.push({ text: text.slice(0, 60), ratio: Number(ratio.toFixed(2)), fg, bg: bgHex })
  }
  const width = innerWidth
  let textOverflow = 0; let offscreen = 0; let smallTap = 0; let tiny = 0
  for (const element of document.querySelectorAll('body *')) {
    const styles = getComputedStyle(element)
    if (styles.display === 'none' || styles.visibility === 'hidden') continue
    const rect = element.getBoundingClientRect(); if (!rect.width || !rect.height) continue
    const scrollable = /(auto|scroll)/.test(`${styles.overflowX}${styles.overflow}`)
    const hidden = /hidden/.test(`${styles.overflowX}${styles.overflow}`)
    const text = (element.innerText || '').trim()
    if (!scrollable && !hidden && element.children.length === 0 && text && element.scrollWidth > element.clientWidth + 2) textOverflow++
    if (rect.right > width + 2 && rect.width > 40 && !scrollable && !element.closest('[style*="overflow"]')) offscreen++
    if ((element.tagName === 'A' || element.tagName === 'BUTTON') && text && (rect.width < 32 || rect.height < 32)) smallTap++
    if (/^(P|LI|DD)$/.test(element.tagName) && text.length > 20 && Number.parseFloat(styles.fontSize) < (width < 600 ? 16 : 15)) tiny++
  }
  const families = new Set(Array.from(document.querySelectorAll('h1,h2,h3,p,a,button,span,li,dd')).map((element) => getComputedStyle(element).fontFamily.split(',')[0].replaceAll('"', '').trim()))
  return { badContrast, offPalette: Array.from(colors).filter((color) => !__canon.includes(color)), layout: { textOverflow, offscreen, smallTap, tiny }, fonts: Array.from(families).filter((font) => !__fonts.includes(font)), h1: document.querySelectorAll('h1').length, description: document.querySelector('meta[name="description"]')?.content || '', canonical: document.querySelector('link[rel="canonical"]')?.href || '' }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--ignore-certificate-errors'] })
const results = []
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (biddeed-critical-gates)' })
  for (const route of routes) {
    const page = await context.newPage()
    let status = 0; let error = ''
    try {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      status = response?.status() || 0
      await page.waitForTimeout(1000)
      await page.addScriptTag({ content: `window.__canon=${JSON.stringify([...canon])};window.__fonts=${JSON.stringify([...fonts])}` })
      const audit = await page.evaluate(`(${sweep.toString()})()`)
      const gates = {
        RENDER: status === 200,
        PALETTE: audit.offPalette.length === 0,
        CONTRAST: audit.badContrast.length === 0,
        SEO: audit.h1 === 1 && audit.description.length > 0 && /^https?:\/\//.test(audit.canonical),
        LAYOUT: Object.values(audit.layout).every((value) => value === 0),
        TYPE: audit.fonts.length === 0 && audit.layout.tiny === 0,
      }
      results.push({ route, viewport: viewport.name, width: viewport.width, status, gates, audit })
    } catch (err) {
      error = String(err).slice(0, 240)
      results.push({ route, viewport: viewport.name, width: viewport.width, status, error, gates: { RENDER: false } })
    } finally { await page.close() }
  }
  await context.close()
}
await browser.close()
const red = results.reduce((sum, result) => sum + Object.values(result.gates).filter((value) => !value).length, 0)
const byGate = {}
for (const result of results) for (const [gate, ok] of Object.entries(result.gates)) if (!ok) byGate[gate] = (byGate[gate] || 0) + 1
const payload = { base, generatedAt: new Date().toISOString(), redGates: red, byGate, results }
fs.writeFileSync(path.join(outDir, 'critical-gates.json'), JSON.stringify(payload, null, 2))
const lines = ['# Critical UI gate results', '', `Base: ${base}`, `Generated: ${payload.generatedAt}`, `Red gates: **${red}**`, '', '| Viewport | Route | HTTP | Failed gates | Layout | Off-palette | Contrast |', '|---|---|---:|---|---|---|---|']
for (const result of results) lines.push(`| ${result.viewport} | ${result.route} | ${result.status} | ${Object.entries(result.gates).filter(([, ok]) => !ok).map(([gate]) => gate).join(', ') || 'none'} | ${JSON.stringify(result.audit?.layout || {})} | ${(result.audit?.offPalette || []).join(' ') || 'none'} | ${result.audit?.badContrast?.length ?? 'n/a'} |`)
fs.writeFileSync(path.join(outDir, 'critical-gates.md'), `${lines.join('\n')}\n`)
console.log(JSON.stringify({ redGates: red, byGate, outDir }, null, 2))
process.exitCode = red ? 1 : 0
