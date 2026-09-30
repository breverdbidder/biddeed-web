# Parcel calendar, registration and lead-capture preparation

REVIEW ONLY. Not production-ready. Do not merge/deploy without completing the gates below.

Flow: visitor chooses exact property from calendar, enters their local assumptions, registers free with email or signs into an existing account before result, then optionally requests generic checklist and separately opts into follow-up. No purchase needed for free result. Registration alone grants no marketing consent. No financial input/memo uploads. SIGNAL$ Max Bid remains withheld.

Prepared: viewer-redacted property-card selection, exact-ID filter/resolver, ID-only URLs, narrowly allowlisted auth return, result access predicate, optional unchecked follow-up UI, generic checklist draft and paid-only Pioneer analytics correction.

Unfinished: wiring/auth result gating across all result outputs, verified email state, local draft lifecycle/shared-browser handling, privacy review, consent version/purpose persistence with revocation support and opaque receipt, checklist delivery integration, full TypeScript/build tests, full UI verification. UI submit stays disabled until storage/queued delivery verified. Current upsert_lead_full void return and OR-merged digest consent do not support this contract. Existing auth default /radar remains for non-Parcel flows. Scope excludes unrelated county/ingest/video work. No migrations, outreach or settings changes.

Synthetic checks: four transpile checks; receipt/default/no-capture checks; nine result-access cases; ID mismatch/empty/duplicate and redaction checks; safe return URL tests. Patches dry-run against recorded source. Full integration/browser visual/build tests pending.

#181 analytics correction: Pioneer confirm includes payment_status; checkout_completed/purchase_completed fire only HTTP success + status ok + payment_status paid. Existing fulfilment condition/call unchanged, screen behavior unchanged. Twelve offline synthetic/source checks passed in analytics preparation. Other #181 requests (QA identities, SPA pageleave, ET boundaries, example/input separation, backend success and popup restoration) remain planned, not falsely claimed implemented.

Apply code only on a review branch, not main. No paid purchase or customer email is authorized by this preparation.

## calendar-selection-card.patch

```diff
--- a/components/auctions/AuctionsLayout.tsx
+++ b/components/auctions/AuctionsLayout.tsx
@@ -372,7 +372,7 @@
                 selectedId={focusId}
                 total={total}
                 onHighlight={handleHighlight}
-                onOpen={(auction) => router.push(`/radar/${auction.id}`)}
+                onOpen={setSelectedAuction}
                 emptyMessage={emptyFilterMessage}
                 onClearFilters={clearFilters}
               />
@@ -393,7 +393,7 @@
           <AuctionTable
             auctions={auctions}
             loading={false}
-            onSelectAuction={(auction) => router.push(`/radar/${auction.id}`)}
+            onSelectAuction={setSelectedAuction}
             emptyMessage={emptyFilterMessage}
             onClearFilters={clearFilters}
           />
@@ -429,7 +429,7 @@
           <AuctionSpreadsheet
             auctions={auctions}
             loading={false}
-            onSelectAuction={(auction) => router.push(`/radar/${auction.id}`)}
+            onSelectAuction={setSelectedAuction}
           />
         )}
 

```

## exact-id-viewer-redacted.patch

```diff
--- a/app/api/auctions/route.ts
+++ b/app/api/auctions/route.ts
@@ -56,6 +56,10 @@
   const supabase = getSupabase()
   const { searchParams } = new URL(request.url)
 
+  const exactId = searchParams.get('id')
+  if (exactId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exactId)) {
+    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
+  }
   const county = searchParams.get('county')
   const type = searchParams.get('type')
   // sale_type is the reliably-populated column (foreclosure/tax_deed).
@@ -97,6 +101,7 @@
     .order('auction_date', { ascending, nullsFirst: false })
     .range(offset, offset + limit - 1)
 
+  if (exactId) query = query.eq('id', exactId)
   if (county) query = query.ilike('county', county)
   if (type) query = query.eq('auction_type', type)
   if (saleType) query = query.eq('sale_type', saleType)

```

## scoped-auth-return.patch

```diff
--- a/app/sign-in/[[...sign-in]]/page.tsx
+++ b/app/sign-in/[[...sign-in]]/page.tsx
@@ -9,8 +9,13 @@
 import { AUTH_CARD_COPY } from '@/lib/auth/clerk-copy'
 import Link from 'next/link'
 import { LIGHT as C } from '@/lib/design-tokens'
+import { allowParcelReturn } from '@/lib/selected-auction'
 
-export default async function SignInCatchAllPage() {
+export default async function SignInCatchAllPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
+  const q = await searchParams
+  const returnTo = allowParcelReturn(typeof q.return_to === 'string' ? q.return_to : null)
+  const destination = returnTo ?? '/radar'
+  const peerAuthUrl = returnTo ? '/sign-up?return_to=' + encodeURIComponent(returnTo) : '/sign-up'
   const h = await headers()
   const clerkLive =
     isClerkHostAuthorized(
@@ -44,7 +49,7 @@
     } catch {
       userId = null
     }
-    if (userId) redirect('/radar')
+    if (userId) redirect(destination)
   }
 
   return (
@@ -59,11 +64,11 @@
             <span style={{ fontSize: '24px', fontWeight: 'bold', color: C.ink }}>BidDeed<span style={{ color: C.brand }}>.AI</span></span>
           </Link>
         </div>
-        {clerkLive && <SignedInRedirect />}
+        {clerkLive && <SignedInRedirect to={destination} />}
         {clerkLive ? (
           <SignIn
-            fallbackRedirectUrl="/radar"
-            signUpUrl="/sign-up"
+            fallbackRedirectUrl={destination}
+            signUpUrl={peerAuthUrl}
             fallback={<AuthCardFallback {...AUTH_CARD_COPY.signIn} />}
           />
         ) : (
--- a/app/sign-up/[[...sign-up]]/page.tsx
+++ b/app/sign-up/[[...sign-up]]/page.tsx
@@ -9,8 +9,13 @@
 import { AUTH_CARD_COPY } from '@/lib/auth/clerk-copy'
 import Link from 'next/link'
 import { LIGHT as C } from '@/lib/design-tokens'
+import { allowParcelReturn } from '@/lib/selected-auction'
 
-export default async function SignUpCatchAllPage() {
+export default async function SignUpCatchAllPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
+  const q = await searchParams
+  const returnTo = allowParcelReturn(typeof q.return_to === 'string' ? q.return_to : null)
+  const destination = returnTo ?? '/radar'
+  const peerAuthUrl = returnTo ? '/sign-in?return_to=' + encodeURIComponent(returnTo) : '/sign-in'
   const h = await headers()
   const clerkLive =
     isClerkHostAuthorized(
@@ -44,7 +49,7 @@
     } catch {
       userId = null
     }
-    if (userId) redirect('/radar')
+    if (userId) redirect(destination)
   }
 
   return (
@@ -58,11 +63,11 @@
             <span style={{ fontSize: '24px', fontWeight: 'bold', color: C.ink }}>BidDeed<span style={{ color: C.brand }}>.AI</span></span>
           </Link>
         </div>
-        {clerkLive && <SignedInRedirect />}
+        {clerkLive && <SignedInRedirect to={destination} />}
         {clerkLive ? (
           <SignUp
-            fallbackRedirectUrl="/radar"
-            signInUrl="/sign-in"
+            fallbackRedirectUrl={destination}
+            signInUrl={peerAuthUrl}
             fallback={<AuthCardFallback {...AUTH_CARD_COPY.signUp} />}
           />
         ) : (

```

## lib/lead-offer.ts

```ts
export type OfferCopy = {
  headline: string
  description: string
  action: string
  deliveryLabel: string
}
export const PARCEL_OFFER: OfferCopy = {
  headline: 'Test an auction deal before you subscribe',
  description: 'Choose a property from the auction calendar and enter your rental, flip or BRRRR numbers. Register free with email or sign in to see your result. Your inputs stay on your device.',
  action: 'Find a property in the calendar',
  deliveryLabel: 'Get the auction due-diligence checklist by email',
}
export type LeadRequest = {
  email: string
  followUpOptIn: boolean
  offer: 'auction_checklist_v1'
  surface: 'pricing' | 'subscribe' | 'parcel_result'
  consentVersion: 'checklist_delivery_v1'
}
export function isStoredReceipt(value: unknown): value is { stored: true; leadId: string; delivery: 'queued' } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.stored === true && v.delivery === 'queued' && typeof v.leadId === 'string' && /^lead_[a-zA-Z0-9_-]{8,80}$/.test(v.leadId)
}

```

## lib/result-gate.ts

```ts
export type ResultAccess = {
  loaded: boolean
  signedIn: boolean
  emailVerified: boolean
  tier: 'anonymous' | 'free' | 'investor' | 'pro' | 'proplus' | 'enterprise'
}
// Tier must come from the authenticated server viewer, never a URL/local flag.
export function mayShowResult(access: ResultAccess): boolean {
  if (!access.loaded || !access.signedIn || !access.emailVerified) return false
  return ['free', 'investor', 'pro', 'proplus', 'enterprise'].includes(access.tier)
}
export const LOCAL_DRAFT_KEY = 'bd_parcel_local_draft_v1'
// No sync/API call. User-entered numbers remain in this same browser only.
export function saveLocalDraft(storage: Pick<Storage, 'setItem'>, draft: unknown): void {
  storage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft))
}

```

## lib/selected-auction.ts

```ts
export const AUCTION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function selectedAuctionHref(id: string): string {
  if (!AUCTION_UUID.test(id)) throw new Error('Invalid selected auction')
  return `/parcel?mca_id=${id.toLowerCase()}`
}
// Filtered endpoint must be integrated before this resolver. Data remains viewer-redacted.
export async function resolveSelectedAuction(id: string, fetcher: typeof fetch) {
  if (!AUCTION_UUID.test(id)) return null
  const response = await fetcher(`/api/auctions?id=${id}&limit=1`, {cache: 'no-store'})
  if (!response.ok) return null
  const payload = await response.json()
  if (!Array.isArray(payload.data) || payload.data.length !== 1) return null
  const row = payload.data[0]
  if (typeof row?.id !== 'string' || row.id.toLowerCase() !== id.toLowerCase()) return null
  // Return no raw/unlisted fields. Source record is not an independent verification of court facts.
  return {id: row.id, county: row.county, property_address: row.property_address,
    auction_date: row.auction_date, sale_type: row.sale_type,
    opening_bid: row.opening_bid, assessed_value: row.assessed_value}
}
export function parcelAuthReturn(id: string | null): string {
  return id && AUCTION_UUID.test(id) ? selectedAuctionHref(id) : '/parcel'
}
// Do not forward arbitrary return URLs or address/assumption query values.
export function allowParcelReturn(value: string | null): string | null {
  if (value === '/parcel') return value
  const match = value?.match(/^\/parcel\?mca_id=([0-9a-f-]+)$/i)
  return match && AUCTION_UUID.test(match[1]) ? selectedAuctionHref(match[1]) : null
}

```

## components/leads/ParcelLeadOffer.tsx

```tsx
'use client'
import { useId, useState, type FormEvent } from 'react'
import { PARCEL_OFFER, isStoredReceipt, type LeadRequest, type OfferCopy } from '../../lib/lead-offer'

type Props = {
  surface: LeadRequest['surface']
  copy?: OfferCopy
  // Review boundary: only enable after verified persistence + delivery are integrated.
  privacyHref?: string
  submitLead?: (request: LeadRequest) => Promise<unknown>
}
export default function ParcelLeadOffer({ surface, copy = PARCEL_OFFER, privacyHref, submitLead }: Props) {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'sending' | 'saved' | 'error'>('idle')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!submitLead || phase === 'sending') return
    setPhase('sending')
    try {
      const receipt = await submitLead({ email: email.trim(), followUpOptIn: followUp, offer: 'auction_checklist_v1', surface, consentVersion: 'checklist_delivery_v1' })
      setPhase(isStoredReceipt(receipt) ? 'saved' : 'error')
    } catch { setPhase('error') }
  }
  return <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-border bg-card p-6">
    <h2 id={`${id}-title`} className="text-xl font-semibold text-foreground">{copy.headline}</h2>
    <p className="mt-3 text-base leading-7 text-muted-foreground">{copy.description}</p>
    <a href="/auctions" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">{copy.action}</a>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">The result uses your numbers and assumptions. It is not a validated SIGNAL$ max bid.</p>
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={`${id}-form`} className="mt-5 min-h-11 text-left text-base underline underline-offset-4">{copy.deliveryLabel}</button>
    {expanded && <form id={`${id}-form`} onSubmit={submit} className="mt-4 space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">Optional. We use this email to deliver the checklist. Your Parcel inputs and memo are not sent.</p>
      <label htmlFor={`${id}-email`} className="block text-base font-medium">Email</label>
      <input id={`${id}-email`} type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base" />
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)} className="mt-1 h-5 w-5" /><span>I'd also like BidDeed to email me about my auction research and plans. Optional; I can unsubscribe.</span></label>
      {privacyHref ? <a href={privacyHref} className="text-sm underline underline-offset-4">Privacy policy</a> : <p className="text-sm">Privacy notice needs review before release.</p>}
      <button type="submit" disabled={!submitLead || phase === 'sending'} className="block min-h-11 rounded-lg bg-primary px-4 py-2 text-base font-semibold text-primary-foreground disabled:opacity-50">{phase === 'sending' ? 'Saving request...' : 'Email me the checklist'}</button>
      {!submitLead && <p role="status" className="text-sm leading-6">Preview only. Email delivery is not connected.</p>}
      {phase === 'saved' && <p role="status">Your checklist request is saved for delivery.</p>}
      {phase === 'error' && <p role="alert">We couldn't save this request. Nothing has been confirmed. You can still use Parcel free.</p>}
    </form>}
  </section>
}

```

## checklist-prep.md

```markdown
# Auction preparation checklist

Draft generic educational content for an optional email requested by a registered visitor. Not delivery-connected, not a property report, not legal advice. No visitor numbers or memo included.

## Confirm the sale
- Open the county clerk or official auction provider's current sale record. Match case or certificate number, parcel and date to the property you chose.
- Check for postponement, cancellation or redemption immediately before the sale. A calendar listing alone is not a guarantee the auction will proceed.
- Read the provider's registration, deposit, payment deadline and bidder rules. Budget for the full cash requirement and fees, not only your bid.

## Check the property and title
- Compare the property description and parcel ID with the appraiser and clerk records. Do not rely on an address alone.
- Review the legal description, title, recorded liens, judgments, taxes and assessments with qualified local title or legal help. Which interests survive depends on the case and jurisdiction; this checklist does not determine that.
- Check occupancy, access, condition, repair scope and any inspection limits. Do not enter without permission.
- Verify zoning, permitted use, utilities, flood risk, insurance and local restrictions from their responsible sources.

## Check your numbers
- Use current comparable sales and rents. An assessment is not your after-repair value.
- Include repairs, holding costs, taxes, insurance, financing and a reserve for unknowns. Compare conservative scenarios, not only a best-case return.
- Parcel's result is arithmetic on your assumptions and buy box. It is not an independent valuation, a guarantee of profit or a validated SIGNAL$ Max Bid.

## Keep the decision yours
- Set a bid limit before the sale and be willing to skip it if facts or costs remain uncertain.
- Keep copies of the source records and your own due diligence. Recheck timing and payment rules before bidding.

Delivery prep boundary: send only after the visitor specifically requests this checklist and a verified persistence/delivery integration exists. No sales follow-up unless separately opted in; current work authorizes no emails.

```

## #181 Pioneer paid-only analytics patch

```diff
--- a/app/pioneers/success/page.tsx
+++ b/app/pioneers/success/page.tsx
@@ -22,7 +22,9 @@
           method: 'POST',
         })
         if (cancelled) return
-        if (res.ok) {
+        const data = await res.json() as { status?: string; payment_status?: string }
+        const settledPaid = res.ok && data.status === 'ok' && data.payment_status === 'paid'
+        if (settledPaid) {
           // Funnel completion (PARITY D14) for the Pioneer Pro conversion.
           // Fires only when confirm succeeds; PostHogIdentify attributes it to
           // the buyer. Server-side (Stripe webhook) is the reliable count and
@@ -35,6 +37,7 @@
             track('purchase_completed', { product: 'pioneer_pro', plan: 'pro_annual', currency: 'usd', surface: 'pioneers_success' })
           } catch {}
         }
+        // The screen's existing success behavior is preserved separately from analytics.
         setStatus(res.ok ? 'ok' : 'error')
       } catch {
         if (!cancelled) setStatus('error')
--- a/app/api/pioneers/confirm/route.ts
+++ b/app/api/pioneers/confirm/route.ts
@@ -25,7 +25,7 @@
     }
 
     await fulfilPioneerCheckout(session)
-    return NextResponse.json({ status: 'ok', tier: 'pro', campaign: '100_pioneers' })
+    return NextResponse.json({ status: 'ok', payment_status: session.payment_status, tier: 'pro', campaign: '100_pioneers' })
   } catch (e) {
     console.error('pioneers confirm failed', e)
     return NextResponse.json({ error: 'confirm failed' }, { status: 500 })

```

## Portable synthetic test source

```js
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {createRequire} from 'node:module'
import assert from 'node:assert/strict'
const require=createRequire(process.cwd()+'/package.json')
const ts=require('typescript')
const root=process.env.PREP_ROOT || process.cwd()
mkdirSync(root+'/compiled/lib',{recursive:true});mkdirSync(root+'/compiled/components/leads',{recursive:true})
for(const file of ['lib/lead-offer.ts','lib/result-gate.ts','lib/selected-auction.ts','components/leads/ParcelLeadOffer.tsx']){
 const s=readFileSync(root+'/'+file,'utf8')
 const out=ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true})
 assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0)
 writeFileSync(root+'/compiled/'+file.replace(/\.tsx?$/,'.js'),out.outputText)
}
const {isStoredReceipt}=require(root+'/compiled/lib/lead-offer.js')
for(const v of [null,{stored:false},{stored:true,leadId:'email@example.invalid',delivery:'queued'},{stored:true,leadId:'lead_12345678',delivery:'failed'}])assert.equal(isStoredReceipt(v),false)
assert.equal(isStoredReceipt({stored:true,leadId:'lead_12345678',delivery:'queued'}),true)
const s=readFileSync(root+'/components/leads/ParcelLeadOffer.tsx','utf8')
assert.match(s,/useState\(false\)/);assert.doesNotMatch(s,/posthog|capture\(|track\(/);assert.doesNotMatch(s,/fetch\(/)
assert.match(s,/Your Parcel inputs and memo are not sent/);assert.match(s,/disabled=\{!submitLead/)
assert.match(s,/surface, consentVersion: 'checklist_delivery_v1'/)
console.log('4 transpile checks + 10 receipt/privacy/default/source checks passed')

const {mayShowResult,saveLocalDraft}=require(root+'/compiled/lib/result-gate.js')
const base={loaded:true,signedIn:true,emailVerified:true,tier:'free'}
assert.equal(mayShowResult(base),true)
for(const x of [{loaded:false},{signedIn:false},{emailVerified:false},{tier:'anonymous'}])assert.equal(mayShowResult({...base,...x}),false)
for(const tier of ['investor','pro','proplus','enterprise'])assert.equal(mayShowResult({...base,tier}),true)
let stored;saveLocalDraft({setItem:(k,v)=>stored=[k,v]},{bid:123});assert.deepEqual(JSON.parse(stored[1]),{bid:123})
console.log('9 result-gate cases + local-only draft roundtrip passed')

const {selectedAuctionHref,resolveSelectedAuction,allowParcelReturn}=require(root+'/compiled/lib/selected-auction.js')
const id='12345678-1234-1234-1234-123456789abc'
assert.equal(selectedAuctionHref(id),'/parcel?mca_id='+id)
assert.throws(()=>selectedAuctionHref('junk'))
for(const v of ['https://evil.invalid','//evil.invalid','/parcel?address=foo','/parcel?mca_id='+id+'&arv=123'])assert.equal(allowParcelReturn(v),null)
assert.equal(allowParcelReturn('/parcel'),'/parcel')
assert.equal(allowParcelReturn(selectedAuctionHref(id)),selectedAuctionHref(id))
const fetchRow=(data)=>async()=>({ok:true,json:async()=>({data})})
assert.equal(await resolveSelectedAuction(id,fetchRow([])),null)
assert.equal(await resolveSelectedAuction(id,fetchRow([{id:'bad'}])),null)
assert.equal(await resolveSelectedAuction(id,fetchRow([{id},{id}])),null)
const row=await resolveSelectedAuction(id,fetchRow([{id,assessed_value:null,owner_name:'not returned'}]))
assert.equal(row.assessed_value,null);assert.equal('owner_name' in row,false)
console.log('ID mismatch/empty/duplicate/redaction + safe-return cases passed')

```
