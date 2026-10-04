import assert from 'node:assert/strict'
import { isBrevard } from '../lib/auctions/county-match.ts'
import { countyDbKey } from '../lib/counties.ts'
import { resolveBcpaoPhotoUrl, buildBcpaoPhotoUrl } from '../lib/bcpao.ts'

// casing: stored value matches, display name matches, others do not
for (const v of ['brevard', 'Brevard', ' BREVARD ']) assert.equal(isBrevard(v), true, v)
for (const v of ['orange', 'indian_river', '', null, undefined, 5]) assert.equal(isBrevard(v), false, String(v))
for (const v of ['brevard', 'Brevard', 'St. Lucie', 'indian-river']) assert.equal(isBrevard(v), countyDbKey(v) === 'brevard', 'parity with countyDbKey ' + v)

// account-format parcel: no network call, URL built directly
let calls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async () => { calls++; throw new Error('should not be called') }) as typeof fetch
assert.equal(await resolveBcpaoPhotoUrl('2209464'), buildBcpaoPhotoUrl('2209464'))
assert.equal(buildBcpaoPhotoUrl('2209464'), 'https://www.bcpao.us/photos/22/2209464011.jpg')
assert.equal(calls, 0, 'digits-only parcel must not call GIS')

// DOR-format parcel: GIS failure modes degrade to null (never throw)
const dor = '22 3517-77-5-2'
globalThis.fetch = (async () => { calls++; throw new Error('network down') }) as typeof fetch
assert.equal(await resolveBcpaoPhotoUrl(dor), null, 'network error -> null')
globalThis.fetch = (async () => { calls++; return new Response('x', { status: 500 }) }) as typeof fetch
assert.equal(await resolveBcpaoPhotoUrl(dor), null, 'HTTP 500 -> null')
globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ features: [] })) }) as typeof fetch
assert.equal(await resolveBcpaoPhotoUrl(dor), null, 'no features -> null')
// timeout contract: the request carries an abort signal and an abort rejects to null
let sawSignal = false
globalThis.fetch = ((_u: unknown, init?: RequestInit) => new Promise((_res, rej) => {
  sawSignal = !!init?.signal
  init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))
  setTimeout(() => rej(new Error('simulated abort')), 20)
})) as typeof fetch
const t0 = Date.now()
assert.equal(await resolveBcpaoPhotoUrl(dor), null, 'aborted -> null')
assert.ok(sawSignal, 'GIS fetch must carry an AbortSignal (10s cap in lib/bcpao.ts)')
assert.ok(Date.now() - t0 < 1000)
globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ features: [{ attributes: { TaxAcct: 2209464 } }] })) }) as typeof fetch
assert.equal(await resolveBcpaoPhotoUrl(dor), 'https://www.bcpao.us/photos/22/2209464011.jpg', 'GIS hit -> built URL')
globalThis.fetch = realFetch
console.log('brevard-county-match: all assertions passed')
