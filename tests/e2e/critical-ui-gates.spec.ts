import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'https://biddeed.ai'
const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
const HOUSE_COLORS = new Set([
  '#ffffff', '#e6f0fa', '#1a1a1a', '#0a2540', '#d7e3f1', '#005eb8', '#004a92',
])
const APPROVED_FONTS = new Set([
  'Inter', 'Inter Fallback', 'Source Serif 4', 'Source Serif 4 Fallback',
  'JetBrains Mono', 'system-ui', 'serif', 'sans-serif', 'monospace',
  'Iowan Old Style', 'ui-monospace', 'Segoe UI Emoji',
])

const criticalRoutes = [
  '/', '/radar', '/radar?view=map', '/radar?view=calendar',
  '/discover', '/auctions', '/sign-in', '/sign-up', '/buy-report',
]

async function auditPage(page: Page) {
  return page.evaluate(({ colors, fonts }) => {
    function luminance(rgb: number[]) {
      const values = rgb.map((value) => {
        const v = value / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
    }
    function parseColor(value: string) {
      const match = value.match(/rgba?\(([^)]+)\)/)
      if (!match) return null
      const parts = match[1].split(',').map(Number)
      return { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 }
    }
    function toHex(rgb: number[]) {
      return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
    }
    function backgroundFor(element: Element) {
      let current: Element | null = element
      while (current) {
        const styles = getComputedStyle(current)
        const parsed = parseColor(styles.backgroundColor)
        if (parsed && parsed.alpha > 0.5) return parsed.rgb
        current = current.parentElement
      }
      return [255, 255, 255]
    }

    const badContrast: Array<{ text: string; ratio: number; foreground: string; background: string }> = []
    const colorsSeen = new Set<string>()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const text = node.textContent?.trim() ?? ''
      if (!text) continue
      const element = node.parentElement
      if (!element) continue
      const styles = getComputedStyle(element)
      if (styles.display === 'none' || styles.visibility === 'hidden' || Number(styles.opacity) === 0) continue
      const foreground = parseColor(styles.color)
      if (!foreground || foreground.alpha === 0) continue
      const background = backgroundFor(element)
      const foregroundLum = luminance(foreground.rgb)
      const backgroundLum = luminance(background)
      const ratio = (Math.max(foregroundLum, backgroundLum) + 0.05) / (Math.min(foregroundLum, backgroundLum) + 0.05)
      const foregroundHex = toHex(foreground.rgb)
      const backgroundHex = toHex(background)
      colorsSeen.add(foregroundHex)
      colorsSeen.add(backgroundHex)
      if (ratio < 4.5) badContrast.push({ text: text.slice(0, 60), ratio, foreground: foregroundHex, background: backgroundHex })
    }

    const viewportWidth = window.innerWidth
    let textOverflow = 0
    let offscreen = 0
    let smallTap = 0
    let tiny = 0
    for (const element of Array.from(document.querySelectorAll('body *'))) {
      const styles = getComputedStyle(element)
      if (styles.display === 'none' || styles.visibility === 'hidden') continue
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const scrollable = /(auto|scroll)/.test(`${styles.overflowX}${styles.overflow}`)
      const hidden = /hidden/.test(`${styles.overflowX}${styles.overflow}`)
      const text = (element.textContent ?? '').trim()
      if (!scrollable && !hidden && element.children.length === 0 && text && element.scrollWidth > element.clientWidth + 2) textOverflow++
      if (rect.right > viewportWidth + 2 && rect.width > 40 && !scrollable && !element.closest('[style*="overflow"]')) offscreen++
      if ((element.tagName === 'A' || element.tagName === 'BUTTON') && text && (rect.width < 32 || rect.height < 32)) smallTap++
      if (/^(P|LI|DD)$/.test(element.tagName) && text.length > 20 && Number.parseFloat(styles.fontSize) < (viewportWidth < 600 ? 16 : 15)) tiny++
    }

    const families = new Set(
      Array.from(document.querySelectorAll('h1,h2,h3,p,a,button,span,li,dd'))
        .map((element) => getComputedStyle(element).fontFamily.split(',')[0].replaceAll('"', '').trim()),
    )
    const offPalette = Array.from(colorsSeen).filter((color) => !colors.includes(color))
    return {
      badContrast,
      offPalette,
      layout: { textOverflow, offscreen, smallTap, tiny },
      fonts: Array.from(families).filter((font) => !fonts.includes(font)),
      h1Count: document.querySelectorAll('h1').length,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
    }
  }, { colors: Array.from(HOUSE_COLORS), fonts: Array.from(APPROVED_FONTS) })
}

for (const route of criticalRoutes) {
  test(`${route} passes desktop critical UI gates`, async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    const response = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
    expect(response?.status(), `${route} should render an HTTP response`).toBe(200)
    await page.waitForTimeout(1000)
    const result = await auditPage(page)
    expect(result.offPalette, `${route} desktop off-palette colors`).toEqual([])
    expect(result.badContrast, `${route} desktop contrast findings`).toEqual([])
    expect(result.layout, `${route} desktop layout findings`).toEqual({ textOverflow: 0, offscreen: 0, smallTap: 0, tiny: 0 })
    expect(result.fonts, `${route} desktop unapproved fonts`).toEqual([])
    expect(result.h1Count, `${route} desktop H1 count`).toBe(1)
    expect(result.description.length, `${route} desktop description`).toBeGreaterThan(0)
    expect(result.canonical, `${route} desktop canonical`).toMatch(/^https?:\/\//)
  })

  test(`${route} passes mobile containment gates`, async ({ page }) => {
    await page.setViewportSize(MOBILE)
    const response = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
    expect(response?.status(), `${route} should render an HTTP response`).toBe(200)
    await page.waitForTimeout(1000)
    const result = await auditPage(page)
    expect(result.offPalette, `${route} mobile off-palette colors`).toEqual([])
    expect(result.badContrast, `${route} mobile contrast findings`).toEqual([])
    expect(result.layout, `${route} mobile layout findings`).toEqual({ textOverflow: 0, offscreen: 0, smallTap: 0, tiny: 0 })
    expect(result.fonts, `${route} mobile unapproved fonts`).toEqual([])
  })
}

test('protected report preserves the unauthenticated contract', async ({ page }) => {
  const response = await page.goto(`${BASE}/report/cad5d07a-b9c7-433d-b365-3165637b7cbe?key=public-audit-fixture`, { waitUntil: 'domcontentloaded' })
  expect(response?.status()).toBeGreaterThanOrEqual(401)
  expect(response?.status()).toBeLessThan(500)
})

test('authenticated report renders all eighteen S5 sections when storage state is provided', async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_STATE, 'Requires a real Clerk storage state; never weaken auth for a public audit.')
  await page.context().addCookies([])
  await page.goto(`${BASE}/report/cad5d07a-b9c7-433d-b365-3165637b7cbe?key=${process.env.SAMPLE_REPORT_KEY ?? ''}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-s5-section], [data-section-number]')).toHaveCount(18)
})
