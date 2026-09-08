import SupportForm from '@/components/support/SupportForm'
import TicketLookup from '@/components/support/TicketLookup'

/**
 * biddeed.ai/support — public support tickets.
 *
 * Reached through the Worker router (cli-anything-biddeed src/worker.js
 * proxies exactly `/support` here; `/support/bot` stays on the Worker and
 * `/contact` 301s to this page). Renders inside the app shell like every
 * other route. Force-dynamic for the per-request CSP nonce — see
 * middleware.ts.
 *
 * Copy rules (canon): Deed is the product's AI agent and the first stop; the
 * report is the "SIGNAL$ Property Report"; no vendor or model names.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Support — BidDeed.AI',
  description:
    'Open a support ticket with BidDeed.AI for auction data, SIGNAL$ Property Reports, billing or your account — or ask Deed for an instant answer.',
  alternates: {
    canonical: 'https://biddeed.ai/support',
  },
}

export default function SupportPage() {
  return (
    <section className="mx-auto min-w-0 w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="support-title">
      <header className="border-b border-border pb-6">
        <p className="text-base font-bold uppercase tracking-[0.16em] text-primary">Support</p>
        <h1 id="support-title" className="font-display mt-2 text-3xl font-medium leading-tight tracking-tight text-foreground sm:text-4xl">
          How can we help?
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-foreground">
          Every ticket gets a number and a reply to your email. For anything time-sensitive on an upcoming sale,
          Deed answers instantly, around the clock.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* Worker route — plain anchor on purpose (see components/shell/nav.ts). */}
          <a
            href="/chat"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">✦</span> Ask Deed first
          </a>
          <p className="text-base leading-7 text-muted-foreground">
            Security issue? Email{' '}
            <a href="mailto:security@biddeed.ai" className="inline-flex items-center py-3.5 font-semibold text-primary underline-offset-4 hover:underline">
              security@biddeed.ai
            </a>{' '}
            or pick “Security concern” below — it is prioritised automatically.
          </p>
        </div>
      </header>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <SupportForm />
        <div className="space-y-8">
          <TicketLookup />
          <aside className="rounded-lg border border-border bg-card p-5 text-base leading-7 text-muted-foreground sm:p-6" aria-label="Other ways to reach us">
            <h2 className="text-lg font-bold text-foreground">Other ways to reach us</h2>
            <ul className="mt-3 space-y-2">
              <li>
                General:{' '}
                <a href="mailto:hello@biddeed.ai" className="inline-flex items-center py-3.5 font-semibold text-primary underline-offset-4 hover:underline">hello@biddeed.ai</a>
              </li>
              <li>
                Privacy requests:{' '}
                <a href="mailto:privacy@biddeed.ai" className="inline-flex items-center py-3.5 font-semibold text-primary underline-offset-4 hover:underline">privacy@biddeed.ai</a>
              </li>
              <li>
                Plans and pricing:{' '}
                <a href="/subscribe" className="inline-flex items-center py-3.5 font-semibold text-primary underline-offset-4 hover:underline">biddeed.ai/subscribe</a>
              </li>
            </ul>
            <p className="mt-4">
              BidDeed.AI is investment decision-support, not legal advice, an appraisal or title insurance. Support
              cannot advise on whether to bid on a specific property.
            </p>
          </aside>
        </div>
      </div>
    </section>
  )
}
