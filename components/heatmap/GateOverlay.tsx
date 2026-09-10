'use client'

import { Lock } from 'lucide-react'
import { PAID_GATE_TIER_SLUG } from '@/lib/heatmap/config'
import { trackHeatmapEvent } from '@/lib/analytics/track'
import { PLANS } from '@/components/deed-home/LandingSections'

const investorPlan = PLANS.find((p) => p.name === 'Investor')
const PAID_GATE_PRICE_LABEL = investorPlan ? `${investorPlan.price}${investorPlan.per}` : ''

interface Props {
  kind: 'signup' | 'paid'
  label: string
  /** true once the user is signed in (so a paid-tier gate reads "upgrade", not "sign up"). */
  signedIn?: boolean
  className?: string
}

/**
 * In-map gate prompt (issue #75: "a in-map prompt, not a hard wall — the
 * locked layers are visible-but-blurred/disabled with a CTA"). Renders as a
 * small overlay row, not a full-page block — callers pair it with blurred
 * content, they don't replace the content with this.
 */
export default function GateOverlay({ kind, label, signedIn, className }: Props) {
  const isSignupGate = kind === 'signup' && !signedIn
  const href = isSignupGate ? '/sign-up' : `/subscribe?tier=${PAID_GATE_TIER_SLUG}`
  const cta = isSignupGate ? 'Create free account' : `Upgrade — ${PAID_GATE_PRICE_LABEL}`

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm ${className ?? ''}`}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <Lock className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <a
        href={href}
        onClick={() =>
          trackHeatmapEvent(isSignupGate ? 'signup_started' : 'upgrade_click', {
            kpi_layer: label,
          })
        }
        className="min-h-8 shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {cta}
      </a>
    </div>
  )
}
