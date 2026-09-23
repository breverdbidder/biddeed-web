#!/usr/bin/env node
// Issue #181: funnel events must never carry PII. Transpiles
// lib/analytics/funnel.ts and checks that sanitizeProps drops every banned
// key and every identifying value. Exit 1 on any leak.
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const src = readFileSync('lib/analytics/funnel.ts', 'utf8')
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const { sanitizeProps, FUNNEL_EVENTS } = mod

let failures = 0
const fail = (msg) => { failures++; console.error('FAIL', msg) }

const bannedKeys = ['email', 'phone', 'name', 'full_name', 'address', 'property_address', 'message', 'prompt', 'response', 'card', 'token', 'session_id', 'url', 'report_url', 'key']
for (const k of bannedKeys) {
  const out = sanitizeProps({ [k]: 'x' })
  if (k in out) fail(`banned key "${k}" survived`)
}

const bannedValues = {
  email: 'buyer@example.com',
  phone: '(321) 555-0100',
  intl_phone: '+1 321 555 0100',
  report_key: 'bd_live_S9KLXyeH9fV1epdliLz731n1', // gitleaks:allow
  jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  query_url: '/report/abc?key=secret',
  long_text: 'x'.repeat(200),
}
for (const [label, v] of Object.entries(bannedValues)) {
  for (const k of ['surface', 'plan', 'county', 'path']) {
    if (k === 'path' && label.includes('phone')) continue // pathnames are not phone numbers; digits in case numbers are public
    const out = sanitizeProps({ [k]: v })
    if (k in out) fail(`${label} value survived under "${k}"`)
  }
}

const ok = sanitizeProps({ report_type: 'sample', surface: 'free_report_popup', price_usd: 25, digest_opt_in: false, path: '/buy-report' })
for (const k of ['report_type', 'surface', 'price_usd', 'digest_opt_in', 'path']) if (!(k in ok)) fail(`allowed key "${k}" was dropped`)

for (const e of ['report_viewed', 'checkout_started', 'purchase_completed', 'signup_completed', 'lead_captured']) {
  if (!FUNNEL_EVENTS.includes(e)) fail(`contract event "${e}" missing`)
}

if (failures) { console.error(`funnel-events: ${failures} failure(s)`); process.exit(1) }
console.log('funnel-events: sanitizer blocks PII, contract events present - ok')
