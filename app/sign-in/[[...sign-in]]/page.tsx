import { SignIn } from '@clerk/nextjs'
import { headers } from 'next/headers'
import { isClerkHostAuthorized } from '@/lib/clerk-host'
import Link from 'next/link'

// Server component: reads the host the same way layout.tsx does, so this page
// and ConditionalClerkProvider can never disagree. Without this, an
// unauthorized host would render <SignIn/> with no provider above it - a
// client-side crash - where before the gate it rendered a form whose every
// request 400'd. Honest degradation instead of either.
export default async function SignInCatchAllPage() {
  const h = await headers()
  const clerkLive = isClerkHostAuthorized(h.get('x-forwarded-host') ?? h.get('host'))
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#F59E0B', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#020617', fontWeight: 'bold', fontSize: '20px' }}>B</span>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc' }}>BidDeed<span style={{ color: '#F59E0B' }}>.AI</span></span>
          </Link>
        </div>
        {clerkLive ? (
          <SignIn fallbackRedirectUrl="/radar" signUpUrl="/sign-up" />
        ) : (
          <div style={{ backgroundColor: '#0b1220', border: '1px solid #334155', borderRadius: '12px', padding: '28px', textAlign: 'center', color: '#e2e8f0' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Sign-in isn&apos;t available on this preview address</p>
            <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#94a3b8' }}>
              Accounts live on the main site. Head to{' '}
              <a href="https://biddeed.ai" style={{ color: '#F59E0B' }}>biddeed.ai</a> to sign in.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
