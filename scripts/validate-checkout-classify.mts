import assert from 'node:assert/strict'
import { classifyCheckoutSession, subscriptionState } from '../lib/checkout-classify.ts'

const c = classifyCheckoutSession
assert.deepEqual(c({ mode: 'subscription', metadata: { tier_id: 'investor' } }), { kind: 'subscription', tier: 'investor' })
assert.deepEqual(c({ mode: 'subscription', metadata: { tier_id: 'pro' } }), { kind: 'subscription', tier: 'pro' })
assert.equal(c({ mode: 'subscription', metadata: {} }).kind, 'refuse') // no tier
assert.equal(c({ mode: 'payment', metadata: { tier_id: 'investor' } }).kind, 'subscription') // tier wins
const ctb = { product: 'clear_to_bid' }
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: ctb }).kind, 'one_time')
assert.equal(c({ mode: 'payment', amount_total: 9999, currency: 'eur', metadata: ctb }).kind, 'one_time') // marker is identity, not amount
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: {} }).kind, 'refuse') // unmarked $25 collision
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: null }).kind, 'refuse') // missing metadata
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: { product: 's5_onetime', mode: 'report' } }).kind, 'refuse') // SIGNAL report
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: { product: 's5_onetime' } }).kind, 'refuse')
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: { product: 'clear_to_bid', mode: 'report' } }).kind, 'refuse')
assert.equal(c({ mode: 'payment', amount_total: 99, currency: 'usd', metadata: {} }).kind, 'refuse')
assert.equal(c({ mode: 'payment', metadata: { product: 'other' } }).kind, 'refuse')
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: { product: 'clear_to_bid', tier_id: 'pro' } }).kind, 'subscription')
assert.equal(c({ mode: 'setup' }).kind, 'refuse')
assert.equal(c({}).kind, 'refuse')

const base = { paymentStatus: 'paid', rowStatus: 'completed', rowCustomerId: 'c1', customerTier: 'investor', tier: 'investor' }
assert.equal(subscriptionState(base), 'subscription_active')
assert.equal(subscriptionState({ ...base, paymentStatus: 'unpaid' }), 'subscription_pending')
assert.equal(subscriptionState({ ...base, rowStatus: 'pending' }), 'subscription_pending')
assert.equal(subscriptionState({ ...base, rowStatus: null }), 'subscription_pending') // missing bookkeeping
assert.equal(subscriptionState({ ...base, rowCustomerId: null }), 'subscription_pending')
assert.equal(subscriptionState({ ...base, customerTier: 'free' }), 'subscription_pending') // webhook did not grant
assert.equal(subscriptionState({ ...base, customerTier: 'pro' }), 'subscription_pending') // wrong tier
console.log('checkout-classify: all assertions passed')
