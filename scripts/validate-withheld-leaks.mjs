// SIGNAL-15: report policy v1 (config/report-field-release.v1.json) withholds
// third-party probability, predicted sale price and SIGNAL$ Max Bid on every
// tier. This gate fails the deploy when web code renders one of them: a
// SIGNAL$ Max Bid label followed by a value, a model probability field, or a
// max-bid/probability field from the engine. It found the D4D route cards,
// the D4D voice readout and the D4D upgrade example printing "SIGNAL$ Max
// Bid", and the public map naming the formula's BID/REVIEW/SKIP call that the
// auction page withholds (fixed 2026-09-24).
// Run: node scripts/validate-withheld-leaks.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DIRS = ['app', 'components', 'lib']
// The policy module itself names the withheld field keys; it renders nothing.
const ALLOW = new Set(['lib/report-field-release.ts'])
const policy = JSON.parse(readFileSync(join(ROOT, 'config/report-field-release.v1.json'), 'utf8'))
const withheld = Object.entries(policy.fields).filter(([, f]) => f.state === 'withheld' && f.public_value_enabled === false).map(([k]) => k)

const RULES = [
  { id: 'max-bid-value', re: /SIGNAL\$ Max Bid[^\n'"`<]{0,12}(\{|\$\{|\$\d)/, why: 'a SIGNAL$ Max Bid label followed by a value' },
  { id: 'engine-max-bid-field', re: /\b(signal_max_bid|shapira_max_bid|shapira_ceiling)\b/, why: 'an engine max-bid field in web code' },
  { id: 'engine-probability-field', re: /\bprobability_third_party_purchase\b/, why: 'the engine third-party probability field in web code' },
  { id: 'predicted-price-field', re: /\bpredicted_final_sale_price\b/, why: 'a predicted sale price field in web code' },
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) { if (name !== 'node_modules' && !name.startsWith('.')) walk(p, out) }
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(p)
  }
  return out
}

const findings = []
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    if (ALLOW.has(relative(ROOT, file))) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return // comments may name the fields
      for (const r of RULES) if (r.re.test(line)) findings.push(`${relative(ROOT, file)}:${i + 1} ${r.why}: ${line.trim().slice(0, 140)}`)
    })
  }
}

if (withheld.length !== 3) {
  console.error(`policy drift: expected 3 withheld fields, found ${withheld.join(', ')}`)
  process.exit(2)
}
if (findings.length) {
  console.error(`Withheld-field leak check FAILED (${findings.length}):\n` + findings.join('\n'))
  process.exit(1)
}
console.log(`Withheld-field leak check passed: ${withheld.join(', ')} are not rendered in app/, components/ or lib/`)
