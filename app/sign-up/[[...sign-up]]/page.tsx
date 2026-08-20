import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignUpCatchAllPage() {
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
        <SignUp fallbackRedirectUrl="/radar" signInUrl="/sign-in" />
      </div>
    </div>
  )
}
