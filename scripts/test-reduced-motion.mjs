#!/usr/bin/env node
// G-STATES negative test 3 (#20184): render a skeleton with
// prefers-reduced-motion: reduce emulated and confirm the shimmer is disabled.
import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'http://localhost:3000'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })

async function check(reducedMotion) {
  const context = await browser.newContext({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' })
  const page = await context.newPage()
  // Throttle to CDP "slow 3g"-ish so the route stays on loading.tsx long enough to sample.
  const client = await context.newCDPSession(page)
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false, latency: 400, downloadThroughput: (300 * 1024) / 8, uploadThroughput: (300 * 1024) / 8,
  })
  const navigation = page.goto(`${base}/counties`, { waitUntil: 'commit' })
  await page.waitForSelector('.animate-pulse', { timeout: 5000 }).catch(() => null)
  const result = await page.evaluate(() => {
    const el = document.querySelector('.animate-pulse')
    if (!el) return { found: false }
    const styles = getComputedStyle(el)
    return {
      found: true,
      animationName: styles.animationName,
      animationDuration: styles.animationDuration,
      animationIterationCount: styles.animationIterationCount,
    }
  })
  await navigation.catch(() => null)
  await context.close()
  return result
}

const normal = await check(false)
const reduced = await check(true)
console.log(JSON.stringify({ normal, reduced }, null, 2))

await browser.close()
