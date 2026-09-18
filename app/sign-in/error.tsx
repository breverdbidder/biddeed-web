'use client'

import Link from 'next/link'
import { LIGHT as C } from '@/lib/design-tokens'

// Segment boundary for the auth routes. The root boundary (app/error.tsx)
// auto-retries on the assumption that failures are routine backend reboots;
// on the auth pages that assumption is wrong — a failed flight render here
// (e.g. the session mid-handshake window after an in-place factor
// completion) left users on a white/frozen screen with no way forward
// (React #441, production 2026-09-18). Offer an explicit way out instead:
// a visitor who just completed a factor is signed in and /radar will load;
// a visitor who is not simply sees the form again on retry.
export default function SignInErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.background, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center', color: C.ink }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Sign-in hiccuped on our side</p>
        <p style={{ margin: '10px 0 0', fontSize: '16px', lineHeight: 1.5, color: C.navy }}>
          If you just entered your details, you are most likely signed in already.
        </p>
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <Link href="/radar" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', padding: '0 24px', backgroundColor: C.brand, color: C.background, borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>
            Continue to Radar
          </Link>
          <button type="button" onClick={reset} style={{ minHeight: '44px', padding: '0 24px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.ink, cursor: 'pointer' }}>
            Try sign-in again
          </button>
        </div>
      </div>
    </div>
  )
}
