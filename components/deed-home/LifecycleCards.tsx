'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'

import type { LifecycleCard, LifecycleState } from '@/lib/deed/agui-client'
import { cn } from '@/lib/utils'

/**
 * The Ask Deed panel's cards (issue #20664). A thin renderer over AG-UI events:
 * it shows what the stream said and never decides anything. The Confirm button
 * calls the confirm endpoint (onConfirm); nothing typed in the thread and nothing
 * in any event can authorize a charge. There is no card field anywhere here.
 */

const HOSTED = /^https:\/\/(checkout|billing)\.stripe\.com\//

const usd = (n: number | undefined) =>
  typeof n === 'number' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : ''

function HostedLink({ url, children }: { url: string; children: React.ReactNode }) {
  // Only a hosted payment / billing page is ever linked; anything else renders as text.
  if (!HOSTED.test(url)) return <span className="text-sm text-muted-foreground">That link could not be verified.</span>
  return (
    <a
      href={url}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      {children} <ExternalLink className="size-4" aria-hidden />
    </a>
  )
}

function Box({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-border bg-card p-4', className)}>{children}</div>
}

function ConfirmCard({ card, onConfirm }: { card: Extract<LifecycleCard, { kind: 'confirm' }>; onConfirm: (ref: string) => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  const expired = card.expires_at ? new Date(card.expires_at).getTime() < now : false
  const busy = card.state === 'working'
  return (
    <Box>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review your order</p>
      <p className="mt-1 text-[15px] leading-6 text-foreground">{card.readback}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {card.state === 'done' ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <CheckCircle2 className="size-4 text-primary" aria-hidden /> Confirmed
          </span>
        ) : (
          <button
            type="button"
            disabled={busy || expired || card.state === 'failed'}
            onClick={() => onConfirm(card.ref)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
            Confirm{typeof card.amount_usd === 'number' && card.amount_usd > 0 ? ` ${usd(card.amount_usd)}` : ''}
          </button>
        )}
        {expired && card.state !== 'done' ? <span className="text-xs text-muted-foreground">Expired — ask me again for a fresh one.</span> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Payment is entered on the secure checkout page, never in this chat.</p>
    </Box>
  )
}

export default function LifecycleCards({ state, onConfirm }: { state: LifecycleState; onConfirm: (ref: string) => void }) {
  if (!state.tools.length && !state.cards.length) return null
  return (
    <div className="space-y-3" data-lifecycle>
      {state.tools.length ? (
        <ul className="space-y-1" aria-label="What Deed did">
          {state.tools.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              {t.done ? <CheckCircle2 className="size-3.5 text-primary" aria-hidden /> : <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />}
              {t.label}
            </li>
          ))}
        </ul>
      ) : null}
      {state.cards.map((c, i) => {
        switch (c.kind) {
          case 'quote':
            return (
              <Box key={i}>
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="tabular mt-1 text-2xl font-semibold text-foreground">
                  {usd(c.amount_usd)}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    {c.one_time ? 'one time' : c.interval === 'annual' ? 'per year' : 'per month'}
                  </span>
                </p>
              </Box>
            )
          case 'confirm':
            return <ConfirmCard key={c.ref} card={c} onConfirm={onConfirm} />
          case 'checkout':
            return (
              <Box key={i}>
                <p className="text-sm text-foreground">Your secure checkout is ready{c.amount_usd ? ` — ${usd(c.amount_usd)}` : ''}.</p>
                <div className="mt-3">
                  <HostedLink url={c.url}>Continue to secure checkout</HostedLink>
                </div>
              </Box>
            )
          case 'link':
            return (
              <Box key={i}>
                <HostedLink url={c.url}>{c.label}</HostedLink>
              </Box>
            )
          case 'account':
            return (
              <Box key={i}>
                <p className="text-sm text-foreground">
                  Plan: <strong className="font-semibold capitalize">{c.plan}</strong> · Billing {c.billing_on_file ? 'on file' : 'not set up'} · Credits{' '}
                  <span className="tabular">{c.credits_balance.toLocaleString('en-US')}</span>
                </p>
              </Box>
            )
          case 'invoices':
            return (
              <Box key={i}>
                {c.invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {c.invoices.map((inv, j) => (
                      <li key={j} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="text-foreground">{inv.date ?? ''} {inv.number ? `· ${inv.number}` : ''}</span>
                        <span className="tabular text-foreground">{usd(inv.amount_usd)} <span className="text-muted-foreground">{inv.status}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Box>
            )
        }
      })}
    </div>
  )
}
