// Runtime check for the Academy routes against a running Worker (local workerd).
// Not a status-code-only check: asserts the rendered HTML has the lesson heading,
// is not a soft 404 / error shell, and that its stylesheets actually load.
const base = process.argv[2]
if (!base) { console.error('usage: node scripts/academy-runtime-check.mjs <base-url>'); process.exit(2) }

const PAGES = [
  ['/academy', 'Start Here'],
  ['/academy/case-studies', 'Case Studies'],
  ['/academy/competitors', 'Education Map'],
  ['/academy/county-playbooks', 'County Playbooks'],
  ['/academy/foreclosures-101', 'Foreclosures 101'],
  ['/academy/how-to-use-biddeed', 'How to Use BidDeed'],
  ['/academy/how-to-use-biddeed/bid-decisions', 'BID, REVIEW, SKIP'],
  ['/academy/investor-paths', 'Investor Paths'],
  ['/academy/lien-priority', 'Lien Priority and the Wipe Rule'],
  ['/academy/tax-deeds-101', 'Tax Deeds 101'],
  ['/academy/tax-deeds-101/due-diligence', 'Due Diligence and Red Flags'],
  ['/academy/tax-deeds-101/glossary', 'Glossary'],
  ['/academy/workbooks', 'Deal Workbooks'],
]
const BAD = ['This page could not be found', 'NEXT_NOT_FOUND', 'Application error', 'Internal Server Error', 'NEXT_REDIRECT']

let failed = 0
const fail = (m) => { failed++; console.error('FAIL ' + m) }

for (const [path, heading] of PAGES) {
  const res = await fetch(base + path, { redirect: 'manual' })
  const html = await res.text()
  const type = res.headers.get('content-type') || ''
  if (res.status !== 200) { fail(`${path} -> ${res.status}`); continue }
  if (!type.includes('text/html')) fail(`${path} content-type ${type}`)
  if (!html.includes('<h1')) fail(`${path} has no <h1`)
  if (!html.includes(heading)) fail(`${path} missing heading text "${heading}"`)
  for (const b of BAD) if (html.includes(b)) fail(`${path} contains error marker "${b}"`)
  const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1])
  if (css.length === 0) fail(`${path} links no stylesheet`)
  for (const href of css) {
    const r = await fetch(new URL(href, base))
    const t = r.headers.get('content-type') || ''
    const body = await r.text()
    if (r.status !== 200 || !t.includes('text/css') || body.length < 100) fail(`${path} stylesheet ${href} -> ${r.status} ${t} ${body.length}b`)
  }
  console.log(`ok ${path} (${html.length}b, ${css.length} stylesheets)`)
}
if (failed) { console.error(`${failed} failure(s)`); process.exit(1) }
console.log(`academy runtime check passed: ${PAGES.length} pages`)
