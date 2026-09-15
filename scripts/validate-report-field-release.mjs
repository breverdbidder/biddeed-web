import fs from 'node:fs'
const p = JSON.parse(fs.readFileSync(new URL('../config/report-field-release.v1.json', import.meta.url)))
if (p.policy_version !== 'signals-field-release-v1') throw new Error('Unexpected release policy version')
if (p.report_offer.price_usd !== 25 || p.report_offer.state !== 'live') throw new Error('One-time report offer must remain live at $25')
for (const key of ['third_party_purchase_probability','predicted_final_sale_price','signals_max_bid']) {
  const f = p.fields[key]
  if (f.tier !== 'pro_plus' || f.state !== 'withheld' || f.public_value_enabled !== false || f.label !== 'Withheld - validation in progress') {
    throw new Error(`${key} must remain hard-off in Pro Plus`)
  }
}
for (const term of ['wrong property','cited source','readable report','refund']) {
  if (!p.report_offer.promise.toLowerCase().includes(term)) throw new Error(`Correction promise missing: ${term}`)
}
console.log(`Validated ${p.policy_version}: $25 evidence report live; 3 Pro Plus model fields hard-off`)
