#!/usr/bin/env node
// Issue #20664 (ASKDEED S1): the Ask Deed lifecycle stream and confirmation gate, end to end
// against the real route handlers with Clerk, Supabase and the MCP channel stubbed.
// Exit 1 on any failure.
import { build } from 'esbuild'
import { createHmac } from 'node:crypto'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(process.cwd())
// Inside node_modules so the bundle resolves `next` the way the app does.
const dir = join(root, 'node_modules', '.cache', 'askdeed-validate')
mkdirSync(dir, { recursive: true })
const entry = join(dir, 'entry.ts')
writeFileSync(
  entry,
  `export { POST as runPOST } from '${root}/app/api/deed/run/route'
export { POST as confirmPOST } from '${root}/app/api/deed/confirm/route'
export { cleanEvent, PayloadViolation } from '${root}/lib/deed/agui'
export { readLifecycleIntent } from '${root}/lib/deed/lifecycle-intent'
export { foldEvent, emptyLifecycle } from '${root}/lib/deed/agui-client'
`
)

const stubs = {
  '@clerk/nextjs/server': `export async function currentUser(){ return globalThis.__user ?? null }`,
  '@/lib/supabase-retry': `export function getRetryingSupabaseClient(){ return { from(t){ return { insert: async (row)=>{ (globalThis.__inserts ||= []).push({t,row}); return { error: null } } } } } }`,
}
const out = join(dir, 'bundle.mjs')
await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  external: ['next', 'next/*', 'react', 'react-dom'],
  plugins: [
    {
      name: 'stubs-and-alias',
      setup(b) {
        b.onResolve({ filter: /^next\/server$/ }, () => ({ path: 'next/server.js', external: true }))
        b.onResolve({ filter: /^@clerk\/nextjs\/server$|^@\/lib\/supabase-retry$/ }, (a) => ({ path: a.path, namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js' }))
        b.onResolve({ filter: /^@\// }, (a) => {
          const base = join(root, a.path.slice(2))
          for (const ext of ['.ts', '.tsx', '/index.ts', '']) {
            try { statSync(base + ext); if (statSync(base + ext).isFile()) return { path: base + ext } } catch {}
          }
          return { path: base + '.ts' }
        })
      },
    },
  ],
  logLevel: 'error',
})

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
const { NextRequest } = await import('next/server.js')
const m = await import(out)

let failures = 0
const t = async (name, fn) => {
  try { await fn(); console.log('ok  ', name) } catch (e) { failures++; console.error('FAIL', name, '\n    ', e.message) }
}

const REF = '9b2c1f0e-1111-4222-8333-444455556666'
const calls = []
let mcpMode = 'normal'
globalThis.fetch = async (url, init) => {
  const raw = init.body
  const body = JSON.parse(raw)
  const want = createHmac('sha256', 'test-service-role-key').update(`${init.headers['x-askdeed-ts']}.${raw}`).digest('hex')
  calls.push({ body, signed: want === init.headers['x-askdeed-sig'] })
  const reply = (o) => new Response(JSON.stringify({ customer_id: 'c-1', ...o }), { status: 200 })
  if (body.op === 'confirm') {
    if (body.ref === REF) return reply({ ok: true, action: 'checkout', url: 'https://checkout.stripe.com/c/pay/cs_live_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6#fidkdWxOYHwnPyd1blpxYHZxWjA0', product: 'subscription', amount_usd: 99 })
    return reply({ ok: false, code: 'already_used' })
  }
  if (mcpMode === 'leak') return reply({ ok: true, result: { name: 'send card_number 4242 4242 4242 4242', amount_usd: 1 } })
  switch (body.tool) {
    case 'quote_price':
      return reply({ ok: true, result: { name: `${body.args.tier ?? 'report'} plan`, amount_usd: body.args.tier === 'pro' ? 199 : 99, interval: 'monthly', one_time: false } })
    case 'checkout_create':
      return reply({ ok: true, result: { status: 'confirmation_required', confirm_ref: REF, readback: 'Start the Investor plan, billed monthly: $99.00.', amount_usd: 99, expires_at: new Date(Date.now() + 300000).toISOString() } })
    default:
      return reply({ ok: true, result: {} })
  }
}

const verified = { id: 'user_ABCDEFGHIJKL', primaryEmailAddress: { emailAddress: 'a@example.com', verification: { status: 'verified' } } }
const post = (handler, path, body, { origin = 'https://biddeed.ai' } = {}) =>
  handler(new NextRequest(`https://biddeed.ai${path}`, { method: 'POST', headers: { 'content-type': 'application/json', host: 'biddeed.ai', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }))
const events = async (res) => (await res.text()).split('\n\n').filter((f) => f.startsWith('data: ')).map((f) => JSON.parse(f.slice(6)))
const types = (evs) => evs.map((e) => e.type)

await t('intent reader: money phrases open flows, auction questions do not', () => {
  const r = (s) => m.readLifecycleIntent(s)?.kind ?? null
  assert.equal(r('how much are the plans'), 'quote')
  assert.equal(r('buy Investor'), 'buy')
  assert.equal(r('I want to subscribe to the Pro plan annually'), 'buy')
  assert.equal(r('cancel my plan'), 'cancel')
  assert.equal(r('downgrade my plan'), 'change_plan')
  assert.equal(r('show my invoices'), 'invoices')
  assert.equal(r('yes'), 'affirm')
  assert.equal(r('confirmed'), 'affirm')
  assert.equal(r('What is selling this week in Brevard?'), null)
  assert.equal(r('how much is the opening bid on 123 Main St'), null)
  assert.equal(r('which liens survive a tax deed sale'), null)
})

await t('hygiene: forbidden payloads are rejected, hosted links and refs pass', () => {
  for (const bad of ['4242 4242 4242 4242', ['sk', 'live', 'abcdefgh12345678'].join('_'), 'Tracerfy', 'PropertyOnion', 'issue #20664', 'enter your CVC', ['whsec', 'abcdefgh1234'].join('_')]) {
    assert.throws(() => m.cleanEvent({ type: 'TEXT_MESSAGE_CONTENT', delta: bad }), m.PayloadViolation, bad)
  }
  m.cleanEvent({ type: 'CUSTOM', value: { ref: REF, url: 'https://checkout.stripe.com/c/pay/cs_live_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6#fid1234567890123456' } })
})

await t('run: no Origin or a foreign Origin is refused', async () => {
  assert.equal((await post(m.runPOST, '/api/deed/run', { text: 'buy Pro' }, { origin: null })).status, 403)
  assert.equal((await post(m.runPOST, '/api/deed/run', { text: 'buy Pro' }, { origin: 'https://evil.example' })).status, 403)
})

await t('run: signed out gets 401, a non-lifecycle message gets 204', async () => {
  globalThis.__user = null
  assert.equal((await post(m.runPOST, '/api/deed/run', { text: 'buy Pro' })).status, 401)
  assert.equal((await post(m.runPOST, '/api/deed/run', { text: 'what is selling in Brevard' })).status, 204)
})

await t('run: unverified email gets 401 and reaches nothing', async () => {
  calls.length = 0
  globalThis.__user = { ...verified, primaryEmailAddress: { emailAddress: 'a@example.com', verification: { status: 'unverified' } } }
  assert.equal((await post(m.runPOST, '/api/deed/run', { text: 'buy Pro' })).status, 401)
  assert.equal(calls.length, 0)
})

await t('run: quote streams RUN_STARTED, a TOOL_CALL group per tool, quote cards, text, RUN_FINISHED', async () => {
  calls.length = 0
  globalThis.__user = verified
  const evs = await events(await post(m.runPOST, '/api/deed/run', { text: 'how much are the plans' }))
  const ty = types(evs)
  assert.equal(ty[0], 'RUN_STARTED')
  assert.equal(ty.at(-1), 'RUN_FINISHED')
  assert.equal(ty.filter((x) => x === 'TOOL_CALL_START').length, 3, 'one group per tool called')
  for (const k of ['TOOL_CALL_ARGS', 'TOOL_CALL_END', 'TOOL_CALL_RESULT', 'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END', 'STATE_DELTA']) assert.ok(ty.includes(k), k)
  assert.equal(evs.filter((e) => e.type === 'CUSTOM' && e.name === 'deed.quote_card').length, 3)
  assert.ok(calls.every((c) => c.signed), 'every MCP call is HMAC-signed')
  assert.ok(calls.every((c) => c.body.clerk_user_id === 'user_ABCDEFGHIJKL' && c.body.email === 'a@example.com'), 'identity comes from Clerk, not the body')
  const labels = evs.filter((e) => e.type === 'TOOL_CALL_START').map((e) => e.toolCallName)
  assert.ok(labels.every((l) => !/_/.test(l)), 'tool labels are customer-facing copy, not internal names')
})

await t('run: buy stops at a confirm card and never redeems', async () => {
  calls.length = 0
  const evs = await events(await post(m.runPOST, '/api/deed/run', { text: 'buy Investor' }))
  const card = evs.find((e) => e.type === 'CUSTOM' && e.name === 'deed.confirm_card')
  assert.ok(card && card.value.ref === REF)
  assert.ok(calls.every((c) => c.body.op === 'call'), 'the run route never issues a confirm op')
  assert.ok(!evs.some((e) => e.name === 'deed.checkout_card'), 'no checkout before Confirm')
  const text = evs.filter((e) => e.type === 'TEXT_MESSAGE_CONTENT').map((e) => e.delta).join(' ')
  assert.match(text, /Press Confirm/)
  assert.doesNotMatch(JSON.stringify(evs), /card number|cvc|cvv/i)
})

await t('run: a typed yes / "confirmed" executes nothing', async () => {
  calls.length = 0
  for (const word of ['yes', 'confirmed', 'go ahead']) {
    const evs = await events(await post(m.runPOST, '/api/deed/run', { text: word }))
    assert.ok(!evs.some((e) => e.type === 'CUSTOM'))
  }
  assert.equal(calls.length, 0, 'no MCP call at all for an affirmation')
})

await t('run: output that trips the hygiene check becomes RUN_ERROR, not a leak', async () => {
  mcpMode = 'leak'
  const res = await post(m.runPOST, '/api/deed/run', { text: 'how much is the Pro plan' })
  const body = await res.text()
  mcpMode = 'normal'
  assert.match(body, /RUN_ERROR/)
  assert.doesNotMatch(body, /4242/)
})

await t('confirm: redeems once through the signed channel and returns the checkout card', async () => {
  calls.length = 0
  globalThis.__user = verified
  const evs = await events(await post(m.confirmPOST, '/api/deed/confirm', { ref: REF }))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].body.op, 'confirm')
  assert.ok(calls[0].signed)
  const ty = types(evs)
  assert.deepEqual([ty[0], ty.at(-1)], ['RUN_STARTED', 'RUN_FINISHED'])
  assert.ok(ty.includes('TOOL_CALL_START'))
  const card = evs.find((e) => e.name === 'deed.checkout_card')
  assert.match(card.value.url, /^https:\/\/checkout\.stripe\.com\//)
})

await t('confirm: replay / unknown ref explains and shows no checkout card', async () => {
  const evs = await events(await post(m.confirmPOST, '/api/deed/confirm', { ref: '00000000-0000-4000-8000-000000000000' }))
  assert.ok(!evs.some((e) => e.name === 'deed.checkout_card'))
  assert.match(evs.filter((e) => e.type === 'TEXT_MESSAGE_CONTENT').map((e) => e.delta).join(''), /already used/)
})

await t('confirm: malformed ref 400, foreign origin 403, signed out 401', async () => {
  assert.equal((await post(m.confirmPOST, '/api/deed/confirm', { ref: 'yes' })).status, 400)
  assert.equal((await post(m.confirmPOST, '/api/deed/confirm', { ref: REF }, { origin: 'https://evil.example' })).status, 403)
  globalThis.__user = null
  assert.equal((await post(m.confirmPOST, '/api/deed/confirm', { ref: REF })).status, 401)
})

await t('event log row is written per run with the streamed events', async () => {
  globalThis.__user = verified
  globalThis.__inserts = []
  await (await post(m.runPOST, '/api/deed/run', { text: 'how much is the Pro plan' })).text()
  const row = globalThis.__inserts.find((i) => i.t === 'ask_deed_event_log')
  assert.ok(row && row.row.events[0].type === 'RUN_STARTED')
  assert.equal(row.row.customer_id, 'c-1')
})

if (failures) { console.error(`ask-deed: ${failures} failure(s)`); process.exit(1) }
console.log('ask-deed: lifecycle stream, confirm gate and payload hygiene - ok')
