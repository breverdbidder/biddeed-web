// Rendered per-request so middleware can stamp a CSP nonce onto every script
// tag. The site-wide CSP uses 'strict-dynamic', under which the browser trusts
// ONLY nonced scripts - and statically prerendered HTML is built before any
// middleware runs, so it can never carry a nonce. Prerendering this route
// silently ships a page whose scripts are all refused. See middleware.ts.
export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bd-navy-900">
      <h1 className="text-5xl font-bold tracking-tight text-white">
        Bid<span className="text-bd-orange">Deed</span>.AI
      </h1>
      <p className="text-lg text-slate-400">Auction Intelligence</p>
    </main>
  )
}
