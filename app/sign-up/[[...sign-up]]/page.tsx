import { SignUp } from '@clerk/nextjs'
import { headers } from 'next/headers'
import { isClerkHostAuthorized } from '@/lib/clerk-host'
import Link from 'next/link'

export default async function SignUpCatchAllPage() {
  const h = await headers()
  const clerkLive =
    isClerkHostAuthorized(
      [h.get('x-forwarded-host'), h.get('host')].filter(Boolean).join(','),
      h.get('x-biddeed-canonical-host')
    ) &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f0e8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#c15f3c', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fffaf3', fontWeight: 'bold', fontSize: '20px' }}>B</span>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f1b16' }}>BidDeed<span style={{ color: '#c15f3c' }}>.AI</span></span>
          </Link>
        </div>
        {clerkLive ? (
          <SignUp fallbackRedirectUrl="/radar" signInUrl="/sign-in" />
        ) : (
          <div style={{ backgroundColor: '#fbfaf7', border: '1px solid #d8cfc2', borderRadius: '12px', padding: '28px', textAlign: 'center', color: '#1f1b16' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Account creation is not configured on this deployment</p>
            <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#766f67' }}>
              Configure the Clerk production key pair for <a href="https://biddeed.ai" style={{ color: '#c15f3c' }}>biddeed.ai</a> to activate accounts.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Create account · BidDeed.AI' }
