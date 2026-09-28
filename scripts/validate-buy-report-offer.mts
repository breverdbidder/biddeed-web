// /buy-report offers checkout only for a deep-linked property the storefront
// sells (lib/buy-report/offer.ts). Before 28 Sep 2026 a ?mca_id= link showed
// the $25 email form for any property, and the checkout refused it only after
// the visitor typed their email.
// Run: node --experimental-strip-types scripts/validate-buy-report-offer.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { countyDisplay, countySlug, decideOffer, type OfferRow } from '../lib/buy-report/offer.ts'

const row = (over: Partial<OfferRow>): OfferRow => ({
  case_number: '2026-0341TD', property_address: '1 MAIN ST', auction_date: '2026-10-01', opening_bid: 5000, sale_type: 'tax_deed', ...over,
})

let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok ${n} ${name}`) }

t('a listed case is sellable, matched case-insensitively and on its sale date when listed twice', () => {
  const rows = [row({ case_number: '2026-0341TD', auction_date: '2026-10-01' }), row({ case_number: '2026-0341TD', auction_date: '2026-11-05', opening_bid: 6000 })]
  const o = decideOffer(rows, '2026-0341td', '2026-11-05')
  assert.equal(o.state, 'sellable')
  assert.equal(o.state === 'sellable' && o.row.opening_bid, 6000)
  assert.equal(decideOffer(rows, '2026-0341TD').state, 'sellable')
})

t('a case the county does not list sends the visitor to the auctions that are on sale', () => {
  const rows = [row({ case_number: '2026-0343TD' }), row({ case_number: '2026-0346TD' })]
  const o = decideOffer(rows, '2026-0348TD')
  assert.equal(o.state, 'other_auctions')
  assert.equal(o.state === 'other_auctions' && o.rows.length, 2)
})

t('a county the storefront does not sell (empty list) says so instead of "calendar sync in progress"', () => {
  assert.equal(decideOffer([], '26092').state, 'county_not_sold')
})

t('a failed listing request keeps the old behaviour (server-side refusal still applies)', () => {
  assert.equal(decideOffer(null, '26092').state, 'unknown')
  assert.equal(decideOffer({ error: 'county required' }, '26092').state, 'unknown')
})

t('junk rows are ignored', () => {
  assert.equal(decideOffer([null, { foo: 1 }], 'x').state, 'county_not_sold')
})

t('county slugs and labels', () => {
  assert.equal(countySlug('Palm-Beach'), 'palm_beach')
  assert.equal(countySlug(' st johns '), 'st_johns')
  assert.equal(countySlug(null), '')
  assert.equal(countyDisplay('palm_beach'), 'Palm Beach')
})

t('both deep-link flows in the page go through decideOffer', () => {
  const src = readFileSync(new URL('../components/buy-report/BuyReportCheckout.tsx', import.meta.url), 'utf8')
  assert.equal((src.match(/decideOffer\(/g) || []).length, 2)
  assert.match(src, /\/buy-report\/auctions\?county=/)
  assert.match(src, /mcaId && !prefillRejected \? mcaId : null/)
})

console.log(`${n} passed`)
