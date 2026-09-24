import { test, expect } from '@playwright/test'

/**
 * PARITY CP-9: "keyboard walkthrough of every route". /chat has its own
 * end-to-end walkthrough (keyboard-walkthrough.spec.ts); this covers every
 * other route the app serves, signed out, with the keyboard only:
 *
 *   1. "Skip to content" is the first stop in the tab order (read from the
 *      DOM, so a field that takes focus on load does not change the answer).
 *   2. Enter on it moves focus into the main region.
 *   3. Tabbing on from there, every stop is a visible element with a visible
 *      focus indicator, focus never falls to <body> before the end of the
 *      page, and it keeps moving (no trap).
 *
 * Routes the Cloudflare Worker still serves (county pages, blog, reels, the
 * legal pages, reports) are not in this list: they are a different template
 * and are tracked separately. Nothing is written.
 */

const ROUTES = [
  '/', '/radar', '/radar?view=calendar', '/radar?view=map', '/auctions', '/pricing', '/counties', '/discover',
  '/projects', '/d4d', '/alerts', '/sign-in', '/sign-up', '/buy-report', '/subscribe', '/pioneers', '/support',
]

// The free-report offer opens by itself after a dwell on some of these pages
// (a modal: it hides the page from the tab order while open, as it should).
// Mark it dismissed, as a visitor who closed it would have, so the walk
// measures the page itself.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bd_frp_dismissed_at', String(Date.now()))
    } catch {
      /* storage blocked: the offer may open; the walk would then fail loudly */
    }
  })
})

for (const route of ROUTES) {
  test(`keyboard: ${route}`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(route, { waitUntil: 'load' })
    // Hydrated: the skip link's handler and the page's own focus logic are live.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)

    const firstStop = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [tabindex]'))
      const tabbable = all.filter((el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && !el.closest('[inert],[aria-hidden="true"]'))
      return (tabbable[0]?.textContent ?? '').trim()
    })
    expect(firstStop, 'the skip link is the first tab stop').toBe('Skip to content')

    await page.getByRole('link', { name: 'Skip to content' }).focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#main') || document.activeElement?.id === 'main')).toBe(true)

    const problems: string[] = []
    const seen = new Set<string>()
    let inMain = 0
    for (let i = 1; i <= 40; i++) {
      await page.keyboard.press('Tab')
      const s = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null
        if (!a || a === document.body) return { end: true as const }
        const r = a.getBoundingClientRect()
        const cs = getComputedStyle(a)
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (!!cs.boxShadow && cs.boxShadow !== 'none')
        const key = `${a.tagName.toLowerCase()}#${a.id}|${(a.getAttribute('aria-label') || a.textContent || a.getAttribute('name') || '').trim().slice(0, 30)}|${Math.round(r.x)},${Math.round(r.y)}`
        return { end: false as const, key, visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', ring, inMain: !!a.closest('#main'), skip: (a.textContent || '').trim() === 'Skip to content' }
      })
      // The end of the page: focus leaves the document (body) or wraps to the top.
      if (s.end || s.skip) break
      if (!s.visible) problems.push(`stop ${i} not visible: ${s.key}`)
      else if (!s.ring) problems.push(`stop ${i} has no focus indicator: ${s.key}`)
      if (s.inMain) inMain++
      seen.add(s.key)
    }
    expect(problems, problems.join('\n')).toEqual([])
    expect(seen.size, 'focus moves from stop to stop (no trap)').toBeGreaterThan(Math.min(3, inMain))
    expect(inMain, 'the main region has keyboard stops').toBeGreaterThan(0)
  })
}
