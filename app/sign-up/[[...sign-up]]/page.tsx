import type { Metadata } from 'next'
import { SignUp } from '@clerk/nextjs'
import { headers } from 'next/headers'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isClerkHostAuthorized } from '@/lib/clerk-host'
import SignedInRedirect from '@/components/auth/SignedInRedirect'
import Link from 'next/link'
import { LIGHT as C } from '@/lib/design-tokens'

export default async function SignUpCatchAllPage() {
  const h = await headers()
  const clerkLive =
    isClerkHostAuthorized(
      [h.get('x-forwarded-host'), h.get('host')].filter(Boolean).join(','),
      h.get('x-biddeed-canonical-host')
    ) &&
    process.env.CLERK_RUNTIME_ENABLED === 'true' &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)

  // A signed-in visitor has nothing to do on the auth pages: their post-success
  // destination is /radar already. Beyond UX, this skips a broken render path:
  // measured on production 2026-09-18, a brand-new account completes email
  // verification, the route re-renders under the now-active session, and the
  // server-components flight render of this page 500s (React #441 client-side),
  // leaving the registrant on a white screen instead of in the app. Redirect
  // before that path executes; auth() resolves null for pending 2FA sessions,
  // so in-progress factor challenges are not bounced.
  if (clerkLive) {
    // auth() THROWS instead of resolving null while the session cookie is
    // mid-handshake right after an in-place factor completion. Measured on
    // production 2026-09-18: the post-password RSC refresh of this route
    // answers 500 (flight digest 54830976@E80), the client surfaces React
    // #441, and the dead transition leaves a correctly-signed-in user stuck
    // on the password form until a manual reload. A thrown auth() proves
    // nothing about the visitor, so treat it as signed-out and render the
    // form: the page is public either way, and ClerkJS completes its own
    // navigation to fallbackRedirectUrl once the session lands.
    let userId: string | null = null
    try {
      userId = (await auth()).userId
    } catch {
      userId = null
    }
    if (userId) redirect('/radar')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.background, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: C.brand, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: C.background, fontWeight: 'bold', fontSize: '20px' }}>B</span>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: C.ink }}>BidDeed<span style={{ color: C.brand }}>.AI</span></span>
          </Link>
        </div>
        {clerkLive && <SignedInRedirect />}
        {clerkLive ? (
          <SignUp fallbackRedirectUrl="/radar" signInUrl="/sign-in" />
        ) : (
          <div style={{ backgroundColor: C.background, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '28px', textAlign: 'center', color: C.ink }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Account creation is not configured on this deployment</p>
            <p style={{ margin: '10px 0 0', fontSize: '16px', lineHeight: 1.5, color: C.navy }}>
              Configure the Clerk production key pair for <a href="https://biddeed.ai" style={{ color: C.brand, display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>biddeed.ai</a> to activate accounts.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Create account · BidDeed.AI',
  description: 'Create a BidDeed.AI account to save searches, receive alerts, and access source-backed auction reports.',
  alternates: { canonical: 'https://biddeed.ai/sign-up' },
}

export const dynamic = 'force-dynamic'
