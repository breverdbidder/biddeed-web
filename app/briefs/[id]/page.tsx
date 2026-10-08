import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import BriefDeck from '@/components/briefs/BriefDeck'
import { loadBrief } from '@/lib/briefs/server'
import { countyLabel, longDate } from '@/lib/briefs/view'

// force-dynamic: middleware mints a per-request CSP nonce, same as every route in this app.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investment brief',
  robots: { index: false, follow: false, nocache: true },
}

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const loaded = await loadBrief(id)
  if (!loaded) notFound()
  const { brief, brand } = loaded
  // White-label accent: the broker's colour replaces the deck's gold; a bad value was dropped upstream.
  const style = brand.primary_color ? ({ ['--gold' as string]: brand.primary_color, ['--gold2' as string]: brand.primary_color } as React.CSSProperties) : undefined
  return (
    <div>
      <link rel="stylesheet" href="/briefs/deck.css" />
      <p className="top">{`${brand.name} · ${countyLabel(brief.input.market.county)} County investment brief · ${longDate(brief.generated_at)}`}</p>
      <div id="deck" style={style}>
        <BriefDeck brief={brief} brand={brand} />
      </div>
      <p className="top foot">
        Informational only; not an appraisal, title opinion, or legal, tax or investment advice.
        {brand.white_label ? ' Data: BidDeed.AI.' : ' © 2026 Everest Capital USA · BidDeed.AI'}
      </p>
    </div>
  )
}
