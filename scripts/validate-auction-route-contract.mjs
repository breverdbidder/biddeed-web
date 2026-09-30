import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const barePage = read('../app/auctions/page.tsx')
const radarPage = read('../app/radar/page.tsx')
const listApi = read('../app/api/auctions/route.ts')
const calendarApi = read('../app/api/auctions/calendar/route.ts')
const cloudflareWorkflow = read('../.github/workflows/cloudflare-production.yml')
const routeComments = [
  read('../next.config.mjs'),
  radarPage,
  read('../app/radar/[id]/page.tsx'),
]

assert.match(
  barePage,
  /<AuctionsLayout\s+initialView="calendar"\s+showHeading=\{false\}\s*\/>/,
  'bare /auctions must explicitly boot AuctionsLayout in calendar mode'
)
assert.match(barePage, /canonical:\s*'https:\/\/biddeed\.ai\/auctions'/)

assert.match(radarPage, /const VIEWS: ViewMode\[\] = \[[^\]]*'calendar'/)
assert.match(radarPage, /const initialView = VIEWS\.includes\(view as ViewMode\)/)
assert.match(radarPage, /initialView=\{initialView\}/)

const listResponse = listApi.slice(listApi.lastIndexOf('return NextResponse.json('))
for (const field of [
  'data: (data || []).map(',
  'total: count',
  'limit,',
  'offset,',
  'viewer_fields_released: viewer',
]) {
  assert.ok(listResponse.includes(field), `/api/auctions response is missing ${field}`)
}

assert.ok(calendarApi.includes("rpc('auctions_calendar_counts'"), '/api/auctions/calendar must use the counts RPC')
const calendarResponse = calendarApi.slice(calendarApi.lastIndexOf('return NextResponse.json('))
for (const field of [
  'date: r.auction_date',
  'foreclosure_count: Number(r.foreclosure_count)',
  'tax_deed_count: Number(r.tax_deed_count)',
  'total: Number(r.total)',
  'total_all: Number(r.total_all)',
  'days_with_auctions:',
]) {
  assert.ok(calendarApi.includes(field), `/api/auctions/calendar counts contract is missing ${field}`)
}
assert.ok(calendarResponse.includes('days, totals'), 'calendar response must keep days and aggregate totals distinct')
assert.ok(calendarResponse.includes('status_scope: statusScope'), 'calendar response must keep its count scope explicit')

assert.match(
  cloudflareWorkflow,
  /for path in [^\n]*\/auctions/,
  'Cloudflare production smoke checks must include bare /auctions'
)

for (const source of routeComments) {
  assert.doesNotMatch(source, /Nothing in this app may claim `?\/?auctions|must never be claimed by this app/i)
  assert.doesNotMatch(source, /GET \/auctions is a JSON API on the Worker/i)
}

const legacyWorkerRouter = new URL('../src/worker.js', import.meta.url)
if (!fs.existsSync(legacyWorkerRouter)) {
  console.log('Legacy /auctions?county=... Worker JSON behavior not exercised: router source is outside this web repo and remains unchanged.')
}

console.log('Auction route contracts validated: bare HTML calendar, distinct /api/auctions list JSON, calendar counts, /radar?view=calendar, and production smoke coverage.')
