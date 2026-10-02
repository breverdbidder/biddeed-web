import assert from 'node:assert/strict'
import { classifyCheckoutSession, subscriptionState } from '../lib/checkout-classify.ts'

const c = classifyCheckoutSession
assert.deepEqual(c({ mode: 'subscription', metadata: { tier_id: 'investor' } }), { kind: 'subscription', tier: 'investor' })
assert.deepEqual(c({ mode: 'subscription', metadata: { tier_id: 'pro' } }), { kind: 'subscription', tier: 'pro' })
assert.equal(c({ mode: 'subscription', metadata: {} }).kind, 'refuse') // no tier
assert.equal(c({ mode: 'payment', metadata: { tier_id: 'investor' } }).kind, 'subscription') // tier wins
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: {} }).kind, 'one_time')
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'USD', metadata: null }).kind, 'one_time')
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'usd', metadata: { mode: 'report' } }).kind, 'refuse')
assert.equal(c({ mode: 'payment', amount_total: 99, currency: 'usd', metadata: {} }).kind, 'refuse')
assert.equal(c({ mode: 'payment', amount_total: 9900, currency: 'usd', metadata: {} }).kind, 'refuse')
assert.equal(c({ mode: 'payment', amount_total: 2500, currency: 'eur', metadata: {} }).kind, 'refuse')
assert.equal(c({ mode: 'payment', amount_total: null, currency: 'usd', metadata: {} }).kind, 'refuse')
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
