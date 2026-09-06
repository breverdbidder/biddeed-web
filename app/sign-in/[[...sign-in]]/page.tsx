import { SignIn } from '@clerk/nextjs'
import { headers } from 'next/headers'
import { isClerkHostAuthorized } from '@/lib/clerk-host'
import Link from 'next/link'

export default async function SignInCatchAllPage() {
  const h = await headers()
  const clerkLive =
    isClerkHostAuthorized(
      [h.get('x-forwarded-host'), h.get('host')].filter(Boolean).join(','),
      h.get('x-biddeed-canonical-host')
    ) &&
    process.env.CLERK_RUNTIME_ENABLED === 'true' &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#005EB8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '20px' }}>B</span>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1A1A1A' }}>BidDeed<span style={{ color: '#005EB8' }}>.AI</span></span>
          </Link>
        </div>
        {clerkLive ? (
          <SignIn fallbackRedirectUrl="/radar" signUpUrl="/sign-up" />
        ) : (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #D7E3F1', borderRadius: '12px', padding: '28px', textAlign: 'center', color: '#1A1A1A' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Sign-in is not configured on this deployment</p>
            <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#0A2540' }}>
              Configure the Clerk production key pair for <a href="https://biddeed.ai" style={{ color: '#005EB8' }}>biddeed.ai</a> to activate accounts.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in · BidDeed.AI' }
