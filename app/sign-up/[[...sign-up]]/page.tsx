import { SignUp } from '@clerk/nextjs'
import { headers } from 'next/headers'
import { isClerkHostAuthorized } from '@/lib/clerk-host'
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
        {clerkLive ? (
          <SignUp fallbackRedirectUrl="/radar" signInUrl="/sign-in" />
        ) : (
          <div style={{ backgroundColor: C.background, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '28px', textAlign: 'center', color: C.ink }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Account creation is not configured on this deployment</p>
            <p style={{ margin: '10px 0 0', fontSize: '16px', color: C.navy }}>
              Configure the Clerk production key pair for <a href="https://biddeed.ai" style={{ color: C.brand, display: 'inline-flex', alignItems: 'center', minHeight: 32 }}>biddeed.ai</a> to activate accounts.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Create account · BidDeed.AI' }
