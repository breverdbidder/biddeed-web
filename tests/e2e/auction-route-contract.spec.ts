import { test, expect, type Page } from '@playwright/test'

const SUMMARY = {
  total: 12,
  by_county: { brevard: 12 },
  by_type: { foreclosure: 4, tax_deed: 8 },
  by_sale_type: { foreclosure: 4, tax_deed: 8 },
  by_zoning: {},
  with_address: 12,
  vacant_land: 0,
  condos: 0,
  upcoming: 12,
  counties_upcoming: 1,
}

const CALENDAR_COUNTS = {
  from: '2026-09-01',
  to: '2026-09-30',
  county: null,
  sale_type: null,
  status_scope: 'live',
  days: [],
  totals: {
    foreclosure_count: 0,
    tax_deed_count: 0,
    other_count: 0,
    total: 0,
    total_all: 0,
    redeemed_count: 0,
    cancelled_count: 0,
    days_with_auctions: 0,
  },
}

async function stubAuctionFeeds(page: Page) {
  const requests = { calendar: 0, list: 0 }

  await page.route('**/api/auctions/summary**', (route) => route.fulfill({ json: SUMMARY }))
  await page.route('**/api/auctions/calendar**', async (route) => {
    requests.calendar++
    await route.fulfill({ json: CALENDAR_COUNTS })
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/auctions') requests.list++
  })

  return requests
}

for (const route of ['/auctions', '/radar?view=calendar']) {
  test(`${route} opens the calendar view and requests calendar counts`, async ({ page }) => {
    const requests = await stubAuctionFeeds(page)
    await page.goto(route, { waitUntil: 'load' })

    if (route === '/auctions') {
      await expect(page.getByRole('heading', { name: 'Auction Calendar' })).toBeVisible()
    }
    await expect(page.locator('.zw-auction-calendar .fc')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toHaveClass(/shadow-sm/)
    await expect.poll(() => requests.calendar).toBeGreaterThan(0)
    expect(requests.list, 'calendar mode must not load the modern list feed').toBe(0)
  })
}

// The compatibility GET /auctions?county=... JSON route belongs to the
// Cloudflare router, which is not in this repository. Its behavior is not
// exercised against production here; this change leaves that router untouched.
