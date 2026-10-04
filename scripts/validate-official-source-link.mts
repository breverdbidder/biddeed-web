import assert from 'node:assert/strict'
import { officialSourceUrl } from '../lib/auctions/official-source.ts'

const base = { county: 'brevard', sale_type: 'foreclosure', auction_date: '2026-10-07', source_url: null }
assert.equal(
  officialSourceUrl(base),
  'https://brevard.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=10/07/2026',
)
assert.equal(officialSourceUrl({ ...base, county: 'Brevard' }), officialSourceUrl(base), 'county casing')
assert.equal(officialSourceUrl({ ...base, source_url: 'https://example.test/x' }), 'https://example.test/x', 'existing wins')
assert.equal(officialSourceUrl({ ...base, county: 'orange' }), null, 'other counties stay null')
assert.equal(officialSourceUrl({ ...base, sale_type: 'tax_deed' }), null, 'tax deed stays null')
assert.equal(officialSourceUrl({ ...base, sale_type: null, auction_type: 'foreclosure' }), officialSourceUrl(base), 'auction_type fallback')
assert.equal(officialSourceUrl({ ...base, auction_date: null }), null)
assert.equal(officialSourceUrl({ ...base, auction_date: '10/07/2026' }), null, 'bad date')
console.log('official-source-link: 8 assertions passed')
