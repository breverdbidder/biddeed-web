import type { Metadata } from 'next'
import { PioneerCheckout } from '@/components/pioneers/PioneerCheckout'

export const metadata: Metadata = {
  title: '100 Pioneers — BidDeed Pro at $990/year (rate locked)',
  description:
    'Hard cap of 100. $990/year for Pro access with a forever rate lock while you stay subscribed. Same price as Investor annual — Pro tier + locked rate.',
  alternates: { canonical: 'https://biddeed.ai/pioneers' },
}

export default async function PioneersPage({
  searchParams,
}: {
  searchParams?: Promise<{ canceled?: string }>
}) {
  const sp = (await searchParams) || {}
  const canceled = sp.canceled === '1'

  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="mb-2 text-base font-semibold uppercase tracking-widest text-primary sm:text-[15px]">
          Founding offer · hard cap 100
        </p>
        <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">100 Pioneers</h1>
        <p className="text-base text-muted-foreground">
          Florida foreclosure &amp; tax deed auction intelligence. Pay $990/year for Pro — not
          Investor — and keep that Pro rate locked for as long as you renew.
        </p>
        {canceled && (
          <p className="mt-4 rounded-lg border border-border bg-secondary px-3 py-2 text-base text-foreground" role="status">
            Checkout canceled. Your seat was not charged.
          </p>
        )}
      </div>
      <PioneerCheckout />
      <p className="mx-auto mt-8 max-w-xl text-center text-base leading-relaxed text-muted-foreground sm:text-[15px]">
        Billing is handled by Stripe. Year one cash at sellout is $99,000 ($990 × 100). This is a
        recurring annual subscription, not a one-time purchase.
      </p>
    </main>
  )
}
