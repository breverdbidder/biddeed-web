import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * PARITY CP-9 ("skeletons everywhere a fetch exceeds 300 ms") and CP-1 §2
 * ("loading, empty and error states for the price fetch and the Stripe
 * redirect: skeleton, not spinner; retry on error; never a blank card").
 *
 * Every API answer here is held, failed or answered with a fixture IN THIS
 * BROWSER ONLY (page.route), so the slow and failed states can be seen on
 * demand against E2E_BASE_URL. Nothing is written and no checkout is started.
 * Runs signed out.
 */

const hold = (ms: number) => new Promise((r) => setTimeout(r, ms))
const SUMMARY = { total: 197803, upcoming: 2608, counties: 67, counties_upcoming: 59, with_address: 195519, by_county: { brevard: 1 }, by_sale_type: { foreclosure: 126925, tax_deed: 70878 }, by_type: {} }

async function visibleLoadingText(page: Page) {
  // Words like "Loading…" that a sighted user would read (screen-reader-only text excluded).
  return page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((e) => e.children.length === 0 && /\bloading\b/i.test(e.textContent || '') && !e.closest('.sr-only'))
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 })
      .map((e) => (e.textContent || '').trim().slice(0, 40)),
  )
}

test.describe('Loading and error states (PARITY CP-9 / CP-1 §2)', () => {
  // Keep the free-report offer (it opens by itself after a dwell) out of the way.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('bd_frp_dismissed_at', String(Date.now()))
      } catch {
        /* storage blocked */
      }
    })
  })

  test('/radar: a skeleton in the page shape while auctions load, never a spinner', async ({ page }) => {
    await page.route('**/api/auctions/summary**', async (r: Route) => { await hold(4000); await r.fulfill({ json: SUMMARY }) })
    await page.route('**/api/auctions?**', async (r: Route) => { await hold(4000); await r.continue() })
    await page.goto('/radar', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[aria-busy="true"] .animate-pulse').first()).toBeVisible({ timeout: 10_000 })
    expect(await page.evaluate(() => [...document.querySelectorAll('.animate-spin')].filter((e) => e.getBoundingClientRect().width > 0).length)).toBe(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Auction Intelligence' })).toBeVisible()
    expect(await visibleLoadingText(page)).toEqual([])
  })

  test('/buy-report: counties load as a skeleton; a failed list says so and Try again recovers', async ({ page }) => {
    let calls = 0
    await page.route('**/buy-report/counties**', async (r: Route) => {
      calls++
      if (calls === 1) { await hold(1500); return r.fulfill({ status: 500, json: { error: 'held by test' } }) }
      return r.fulfill({ json: [{ county_slug: 'brevard', display: 'Brevard', upcoming: 12, next_auction_date: '2026-10-01', is_gold_standard: true }] })
    })
    await page.goto('/buy-report', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[role="status"][aria-busy="true"] .animate-pulse').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Could not load counties.')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByLabel('Select a county')).toBeVisible({ timeout: 20_000 })
    expect(calls).toBe(2)
  })

  test('/pioneers: the seat count loads as a placeholder; a failed count leaves the purchase open', async ({ page }) => {
    let calls = 0
    await page.route('**/api/pioneers/availability**', async (r: Route) => {
      calls++
      if (calls === 1) { await hold(1500); return r.fulfill({ status: 503, json: { error: 'held by test' } }) }
      return r.fulfill({ json: { sold: 3, cap: 100, remaining: 97, soldOut: false, offer: { priceAnnualUsd: 990, tier: 'pro', rateLock: 'renewal', listProAnnualUsd: 1990 } } })
    })
    await page.goto('/pioneers', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Loading seats left')).toBeAttached({ timeout: 10_000 })
    const retry = page.getByRole('button', { name: /Seats left unavailable/ })
    await expect(retry).toBeVisible({ timeout: 10_000 })
    await page.getByLabel(/Email for Stripe receipt/).fill('e2e-no-checkout@example.com')
    await expect(page.getByRole('button', { name: /Continue to Stripe/ })).toBeEnabled()
    await retry.click()
    await expect(page.getByText('97 of 100 left')).toBeVisible({ timeout: 20_000 })
  })

  test('/discover: coverage loads as a placeholder and a failed summary says it is unavailable', async ({ page }) => {
    await page.route('**/api/auctions/summary**', async (r: Route) => { await hold(2000); await r.fulfill({ status: 502, json: { error: 'held by test' } }) })
    await page.goto('/discover', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Loading coverage')).toBeAttached({ timeout: 10_000 })
    await expect(page.getByText('Coverage unavailable right now')).toBeVisible({ timeout: 10_000 })
    expect(await page.getByText('Coverage status is loading').count()).toBe(0)
  })

  test('/alerts: the four panels load as skeleton rows, not "Loading…" text', async ({ page }) => {
    for (const p of ['**/api/alerts/**', '**/api/saved-searches**', '**/api/watchlist**']) {
      await page.route(p, async (r: Route) => { await hold(4000); await r.continue() })
    }
    await page.goto('/alerts', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[aria-busy="true"] .animate-pulse').first()).toBeVisible({ timeout: 10_000 })
    expect(await visibleLoadingText(page)).toEqual([])
  })
})
