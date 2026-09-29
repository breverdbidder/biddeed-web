// Parcel on biddeed.ai (vendored from breverdbidder/parcel into lib/parcel).
// Run: npm run test:parcel   (node --experimental-strip-types, no install)
//
// 1. Upstream's own expectations still hold, so the vendored math is the
//    formula upstream ships (CLAUDE.md there: "If those three move, the
//    formula changed").
// 2. The desk's auction defaults: a cash purchase (Florida clerk sales settle
//    in full within about a day) gives no loan and no debt service.
// 3. Nothing in Parcel or the desk reaches the network or a model vendor.
// 4. The /parcel prefill accepts only clean public facts and round-trips the
//    pin card's link.
// 5. The call is never presented as a SIGNAL$ figure.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_BUY_BOX,
  analyze,
  dealFromAuctionLot,
  everestMaxBid,
  findSample,
  mortgagePayment,
  toBidDeedCall,
  underwriteLot,
} from '../lib/parcel/index.ts'
import { EMPTY_PREFILL, isAuctionPrefill, parcelLink, parsePrefill } from '../lib/parcel-prefill.ts'

let n = 0
const t = (name: string, fn: () => void) => {
  fn()
  n++
  console.log(`ok ${n} ${name}`)
}
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

t('upstream: 6.75% / 30-year payment factor', () => {
  assert.ok(Math.abs(mortgagePayment(121_600, 6.75, 30) - 789) < 2)
})

t('upstream: the three worked files keep their calls', () => {
  const kc = analyze(findSample('kc-northeast')!, DEFAULT_ASSUMPTIONS, DEFAULT_BUY_BOX)
  assert.equal(kc.verdict, 'buy')
  assert.equal(toBidDeedCall(kc.verdict), 'BID')
  assert.ok(kc.capRate > 9 && kc.coc > 11)
  const denver = analyze(findSample('denver-platt')!, DEFAULT_ASSUMPTIONS, DEFAULT_BUY_BOX)
  assert.equal(toBidDeedCall(denver.verdict), 'SKIP')
  assert.ok(denver.cashFlowAnnual < 0)
  const indy = analyze(findSample('indy-east')!, DEFAULT_ASSUMPTIONS, DEFAULT_BUY_BOX)
  assert.equal(toBidDeedCall(indy.verdict), 'REVIEW')
})

t('upstream: Everest desk ceiling (ARV x 70%) - rehab - 10,000 - min(25,000, 15% ARV)', () => {
  assert.equal(Math.round(everestMaxBid(160_000, 25_000)), 53_000)
  assert.equal(Math.round(everestMaxBid(400_000, 50_000)), 400_000 * 0.7 - 50_000 - 10_000 - 25_000)
})

t('desk default: a cash purchase has no loan and no debt service', () => {
  const lot = { id: 'x', address: '10 Courthouse Rd', county: 'Brevard', state: 'FL', openingBid: 82_000, assessedValue: 140_000, taxesAnnual: 1_800, rentMonthly: 1_400, rehab: 25_000, arv: 160_000 }
  const cash = underwriteLot(lot, { ...DEFAULT_ASSUMPTIONS, downPct: 100 })
  assert.equal(cash.analysis.loanAmount, 0)
  assert.equal(cash.analysis.debtService, 0)
  assert.ok(['BID', 'REVIEW', 'SKIP'].includes(cash.call))
  const financed = underwriteLot(lot)
  assert.ok(financed.analysis.loanAmount > 0, 'unticking cash applies the financed defaults')
})

t('desk: every strategy returns a call on an auction lot', () => {
  for (const strategy of ['hold', 'flip', 'brrrr'] as const) {
    const deal = dealFromAuctionLot({ id: 'x', address: 'a', openingBid: 60_000, arv: 150_000, rehab: 30_000, rentMonthly: 1_500, taxesAnnual: 2_000 })
    deal.strategy = strategy
    const a = analyze(deal, { ...DEFAULT_ASSUMPTIONS, downPct: 100 }, DEFAULT_BUY_BOX)
    assert.ok(['buy', 'watch', 'pass'].includes(a.verdict), strategy)
    assert.ok(a.reasons.length > 0 && a.statement.length > 0, strategy)
  }
})

t('no network, no model vendor in the engine or the desk', () => {
  const files = [
    ...readdirSync(new URL('../lib/parcel/', import.meta.url)).filter((f) => f.endsWith('.ts')).map((f) => `lib/parcel/${f}`),
    'lib/parcel-prefill.ts',
    'components/parcel/ParcelDesk.tsx',
  ]
  assert.equal(files.filter((f) => f.startsWith('lib/parcel/')).length, 7, 'the seven vendored engine files')
  for (const f of files) {
    const src = read(f)
    for (const banned of [/\bfetch\s*\(/, /XMLHttpRequest/, /\bimport\s*\(/, /https?:\/\/(?!biddeed\.ai)/, /openai|anthropic|perplexity|grok|langchain/i]) {
      assert.ok(!banned.test(src), `${f} matches ${banned}`)
    }
  }
})

t('prefill: only clean public facts survive', () => {
  const p = parsePrefill({
    mca_id: '687890C6-7D63-4A13-B73D-090EB4AA3FB3',
    county: 'Palm Beach',
    address: '  9069 PROSPERITY LAKE DR<script>  ',
    opening_bid: '$2,584.35',
    assessed: '-5',
    arv: 'abc',
    date: '2026-10-14T00:00:00',
    sale_type: 'tax_deed',
  })
  assert.equal(p.mcaId, '687890c6-7d63-4a13-b73d-090eb4aa3fb3')
  assert.equal(p.county, 'palm_beach')
  assert.equal(p.address, '9069 PROSPERITY LAKE DRscript')
  assert.equal(p.openingBid, 2584)
  assert.equal(p.assessedValue, 0)
  assert.equal(p.arv, 0)
  assert.equal(p.auctionDate, '2026-10-14')
  assert.equal(p.saleType, 'tax_deed')
  assert.equal(parsePrefill({ mca_id: 'not-a-uuid', opening_bid: '1e12' }).mcaId, null)
  assert.equal(parsePrefill({ opening_bid: '1e12' }).openingBid, 0)
  assert.equal(isAuctionPrefill(EMPTY_PREFILL), false)
})

t('prefill: the pin card link round-trips, and carries nothing the card lacks', () => {
  const href = parcelLink({ id: '687890c6-7d63-4a13-b73d-090eb4aa3fb3', county: 'Duval', property_address: '9069 PROSPERITY LAKE DR', auction_date: '2026-10-14', opening_bid: 2584.35, assessed_value: null, sale_type: 'tax_deed' })
  assert.ok(href.startsWith('/parcel?'))
  const q = Object.fromEntries(new URLSearchParams(href.split('?')[1]))
  assert.ok(!('assessed' in q), 'an anonymous viewer has no assessed value, so the link has none')
  const back = parsePrefill(q)
  assert.equal(back.county, 'duval')
  assert.equal(back.openingBid, 2584)
  assert.equal(back.auctionDate, '2026-10-14')
  assert.equal(isAuctionPrefill(back), true)
})

t('copy: the call is the visitor’s own, never a SIGNAL$ figure', () => {
  const desk = read('components/parcel/ParcelDesk.tsx')
  assert.match(desk, /It is not a SIGNAL\$ verdict/)
  assert.match(desk, /Your numbers say/)
  assert.ok(!/SIGNAL\$ Max Bid/.test(desk))
  assert.ok(!/SIGNAL\$ (verdict|call)\s*[:=]/.test(desk))
  // no call on an auction's opening bid alone: the visitor's own ARV or rent first
  assert.match(desk, /if \(!\(inputs\.bid > 0\) \|\| !\(inputs\.arv > 0 \|\| inputs\.rentMonthly > 0\)\) return null/)
  const pin = read('components/auctions/AuctionPinCard.tsx')
  assert.match(pin, /href=\{parcelLink\(/)
})

console.log(`${n} passed`)
