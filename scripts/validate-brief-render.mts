// Issue 20700 B2: view helpers for /briefs/<id> (money never $0, brand sanitising, M3 leak scan).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { money, pct, brandFromOrg, safeLogoUrl, safeColor, internalLeaks, DEFAULT_BRAND, longDate } from '../lib/briefs/view.ts'

assert.equal(money(182495), '$182,495')
assert.equal(money(null), '—')
assert.equal(money(undefined), '—')
assert.equal(money(NaN), '—')
assert.equal(pct(0.0735), '7.3%')
assert.equal(longDate('2026-10-21'), 'October 21, 2026')
assert.equal(longDate(null), '—')

assert.equal(safeLogoUrl('http://biddeed.ai/x.png'), null)
assert.equal(safeLogoUrl('https://evil.example/x.png'), null)
assert.equal(safeLogoUrl('https://abc.supabase.co/storage/v1/object/public/logos/a.png'), 'https://abc.supabase.co/storage/v1/object/public/logos/a.png')
assert.equal(safeLogoUrl('javascript:alert(1)'), null)
assert.equal(safeColor('#1E3A5F'), '#1E3A5F')
assert.equal(safeColor('red; background:url(x)'), null)

assert.deepEqual(brandFromOrg(null), DEFAULT_BRAND)
const b = brandFromOrg({ name: 'Coastal Realty', logo_url: 'https://x.supabase.co/a.png', license_no: 'BK123', primary_color: '#336699' })
assert.equal(b.white_label, true)
assert.equal(b.license_no, 'BK123')

assert.deepEqual(internalLeaks('County property appraiser sales; County Clerk sale list; HUD Fair Market Rents'), [])
assert.ok(internalLeaks('see issue #20700').length > 0)
assert.ok(internalLeaks('scraped with Firecrawl').length > 0)
assert.ok(internalLeaks('table multi_county_auctions').length > 0)

// The saved sample brief renders no internal names.
const sample = readFileSync(new URL('../tests/fixtures/brief-sample.json', import.meta.url), 'utf8')
assert.deepEqual(internalLeaks(sample), [], 'sample brief leaks an internal name')
console.log('validate-brief-render: ok')
