'use client'

import { useEffect, useState } from 'react'

type Phase = 'confirming' | 'delivered' | 'pending' | 'unpaid' | 'error'

const FILES = [
  ['The 7-Day Auction Readiness System', 'PDF · the core system, one day per chapter'],
  ['The Action Vault', 'Interactive · where you track each day as you work it'],
  ['County Selection Matrix', 'XLSX · all 67 Florida counties, scored'],
  ['Maximum Allowable Bid Worksheet', 'XLSX · the Shapira Formula, live'],
  ['Auction Intelligence', 'PDF · the full reference volume'],
]

export default function SuccessClient() {
  const [phase, setPhase] = useState<Phase>('confirming')
  const [email, setEmail] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')

    if (!sessionId) {
      // Someone reached /success without coming through Stripe. Not an error
      // worth alarming them about -- their email is still the source of truth.
      setPhase('pending')
      return
    }

    let cancelled = false

    fetch(`/radar/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
    })
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        if (cancelled) return
        if (data.status === 'ok') {
          setEmail((data.email as string) ?? null)
          setPhase('delivered')
        } else if (data.status === 'unpaid') {
          setPhase('unpaid')
        } else {
          // Fulfilment still happens on the fifteen-minute reconciliation pass,
          // so this is a delay, not a lost order. Say so plainly.
          setDetail((data.error as string) ?? null)
          setPhase('pending')
        }
      })
      .catch(() => {
        if (!cancelled) setPhase('pending')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main style={S.main}>
      <div style={S.card}>
        <div style={S.brand}>BidDeed.AI</div>

        {phase === 'confirming' && (
          <>
            <h1 style={S.h1}>Confirming your payment</h1>
            <p style={S.lede}>One moment. Do not close this tab.</p>
          </>
        )}

        {phase === 'delivered' && (
          <>
            <h1 style={S.h1}>You&rsquo;re in.</h1>
            <p style={S.lede}>
              Payment confirmed. Your five files are on their way to{' '}
              <strong style={S.strong}>{email ?? 'the address you used at checkout'}</strong>.
            </p>
          </>
        )}

        {phase === 'pending' && (
          <>
            <h1 style={S.h1}>Payment received</h1>
            <p style={S.lede}>
              Your files are being prepared. The delivery email arrives within 15 minutes.
              Nothing further is needed from you.
            </p>
          </>
        )}

        {phase === 'unpaid' && (
          <>
            <h1 style={S.h1}>This checkout is not complete</h1>
            <p style={S.lede}>
              Stripe has not recorded a payment for this session. If you believe you were
              charged, reply to any BidDeed.AI email and we will look it up.
            </p>
          </>
        )}

        {(phase === 'delivered' || phase === 'pending') && (
          <>
            <div style={S.divider} />
            <div style={S.listLabel}>What you bought</div>
            <ul style={S.list}>
              {FILES.map(([name, note]) => (
                <li key={name} style={S.item}>
                  <span style={S.itemName}>{name}</span>
                  <span style={S.itemNote}>{note}</span>
                </li>
              ))}
            </ul>
            <div style={S.divider} />
            <p style={S.next}>
              <span style={S.nextLabel}>Start here:</span> Day 1 in the PDF. The Action Vault is
              where you track it. Download links stay live for 30 days.
            </p>
          </>
        )}

        {detail && <p style={S.detail}>{detail}</p>}

        <div style={S.footer}>
          <a href="/radar" style={S.link}>
            Auction calendar &amp; map
          </a>
          <a href="/" style={S.link}>
            biddeed.ai
          </a>
        </div>
      </div>
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: '#020617',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    background: '#0b1220',
    border: '1px solid #1e293b',
    borderRadius: 14,
    padding: '36px 32px',
  },
  brand: {
    fontSize: 12,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#38bdf8',
    fontWeight: 700,
    marginBottom: 22,
  },
  h1: { fontSize: 27, lineHeight: 1.2, margin: '0 0 12px', color: '#f1f5f9', fontWeight: 700 },
  lede: { fontSize: 15.5, lineHeight: 1.65, margin: 0, color: '#94a3b8' },
  strong: { color: '#e2e8f0', fontWeight: 600 },
  divider: { height: 1, background: '#1e293b', margin: '26px 0' },
  listLabel: {
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#64748b',
    fontWeight: 700,
    marginBottom: 14,
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 },
  item: { display: 'flex', flexDirection: 'column', gap: 3 },
  itemName: { fontSize: 14.5, color: '#e2e8f0', fontWeight: 600 },
  itemNote: { fontSize: 13, color: '#64748b' },
  next: { fontSize: 14.5, lineHeight: 1.6, margin: 0, color: '#94a3b8' },
  nextLabel: { color: '#38bdf8', fontWeight: 600 },
  detail: { fontSize: 12.5, color: '#475569', marginTop: 18, marginBottom: 0 },
  footer: { display: 'flex', gap: 20, marginTop: 30, paddingTop: 20, borderTop: '1px solid #1e293b' },
  link: { fontSize: 13.5, color: '#38bdf8', textDecoration: 'none', fontWeight: 500 },
}
