#!/usr/bin/env node
// G-STATES negative test 2 (#20184): forces a zero-row filtered result and
// confirms the empty state names the active filter and offers one widening action.
import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'http://localhost:3000'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()

await page.goto(`${base}/radar?county=hamilton&sale_type=tax_deed&view=table`, { waitUntil: 'load' })
await page.waitForSelector('text=/No .*Hamilton/i', { timeout: 15000 }).catch(() => null)

const result = await page.evaluate(() => {
  const body = document.body.innerText
  const clearBtn = [...document.querySelectorAll('button')].find((b) => /clear filters/i.test(b.textContent || ''))
  return {
    hasBareNoResults: /^No results\.?$/im.test(body),
    emptyStateText: [...document.querySelectorAll('p')].map((p) => p.textContent).find((t) => t && /No .*hamilton/i.test(t)),
    clearFiltersButtonPresent: Boolean(clearBtn),
  }
})
console.log(JSON.stringify(result, null, 2))

// Click "Clear filters" and confirm the county/type params are removed from the URL.
const clearBtn = page.getByRole('button', { name: /clear filters/i }).first()
await clearBtn.click()
await page.waitForTimeout(800)
console.log('URL after Clear filters click:', page.url())

await browser.close()
