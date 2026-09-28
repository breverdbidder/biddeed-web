// The auction pin card asks who is viewing on every card open
// (lib/auctions/viewer-state.ts). Before 28 Sep 2026 the first answer was kept
// for the whole page session, so a visitor who signed up kept the anonymous
// locks and "Unlock with Free".
// Run: node --experimental-strip-types scripts/validate-pin-card-viewer.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createViewerResolver, viewerFromAnswer, type TierAnswer } from '../lib/auctions/viewer-state.ts'

const RANK: Record<string, number> = { free: 0, investor: 1, pro: 2, proplus: 3, enterprise: 4 }
const atLeastInvestor = (tierId: string) => (RANK[tierId] ?? 0) >= 1

let n = 0
const t = async (name: string, fn: () => Promise<void> | void) => {
  await fn()
  n++
  console.log(`ok ${n} ${name}`)
}

await t('the server answer maps to the three card states', () => {
  assert.equal(viewerFromAnswer({ tier_id: 'free', signed_in: false }, atLeastInvestor), 'anonymous')
  assert.equal(viewerFromAnswer({ tier_id: 'free', signed_in: true }, atLeastInvestor), 'free_member')
  assert.equal(viewerFromAnswer({ tier_id: 'investor', signed_in: true }, atLeastInvestor), 'investor')
  assert.equal(viewerFromAnswer({ tier_id: 'pro', signed_in: true }, atLeastInvestor), 'investor')
  assert.equal(viewerFromAnswer({}, atLeastInvestor), 'anonymous')
})

await t('a visitor who signs up gets the member card on the next open, not the anonymous locks', async () => {
  const answers: TierAnswer[] = [{ tier_id: 'free', signed_in: false }, { tier_id: 'free', signed_in: true }]
  let asked = 0
  const r = createViewerResolver(async () => answers[asked++], atLeastInvestor)
  assert.equal(r.last(), null)
  assert.equal(await r.resolve(), 'anonymous')
  assert.equal(r.last(), 'anonymous')
  // ...signs up in the same page session, opens another card:
  assert.equal(await r.resolve(), 'free_member')
  assert.equal(r.last(), 'free_member')
  assert.equal(asked, 2)
})

await t('an upgrade to Investor shows on the next open', async () => {
  const answers: TierAnswer[] = [{ tier_id: 'free', signed_in: true }, { tier_id: 'investor', signed_in: true }]
  let asked = 0
  const r = createViewerResolver(async () => answers[asked++], atLeastInvestor)
  assert.equal(await r.resolve(), 'free_member')
  assert.equal(await r.resolve(), 'investor')
})

await t('cards opened together share one request', async () => {
  let asked = 0
  let release: (a: TierAnswer) => void = () => {}
  const r = createViewerResolver(
    () => {
      asked++
      return new Promise<TierAnswer>((res) => (release = res))
    },
    atLeastInvestor
  )
  const a = r.resolve()
  const b = r.resolve()
  await Promise.resolve()
  release({ tier_id: 'free', signed_in: true })
  assert.deepEqual(await Promise.all([a, b]), ['free_member', 'free_member'])
  assert.equal(asked, 1)
})

await t('a failed or malformed answer fails closed to anonymous', async () => {
  const r = createViewerResolver(async () => {
    throw new Error('network')
  }, atLeastInvestor)
  assert.equal(await r.resolve(), 'anonymous')
  const bad = createViewerResolver(() => Promise.reject(new SyntaxError('Unexpected token <')), atLeastInvestor)
  assert.equal(await bad.resolve(), 'anonymous')
  const throwsSync = createViewerResolver(() => {
    throw new Error('sync')
  }, atLeastInvestor)
  assert.equal(await throwsSync.resolve(), 'anonymous')
})

await t('the card asks through the resolver on every open and ships no emoji in its controls', () => {
  const src = readFileSync(new URL('../components/auctions/AuctionPinCard.tsx', import.meta.url), 'utf8')
  assert.match(src, /createViewerResolver\(/)
  assert.match(src, /viewerResolver\.resolve\(\)/)
  assert.doesNotMatch(src, /viewerPromise/)
  assert.doesNotMatch(src, /\p{Extended_Pictographic}/u)
})

console.log(`${n} passed`)
