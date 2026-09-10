'use client'

import { useState } from 'react'
import { ChevronDown, Lock, MapPin } from 'lucide-react'
import { KPI_LAYERS, GRANULARITY_GATE, type Granularity } from '@/lib/heatmap/config'
import { cn } from '@/lib/utils'

interface Props {
  activeLayerId: string
  granularity: Granularity
  signedIn: boolean
  paidEntitled: boolean
  onSelectLayer: (layerId: string) => void
  onSelectGranularity: (g: Granularity) => void
  compact?: boolean
}

function isUnlocked(tier: 'free' | 'signup' | 'paid', signedIn: boolean, paidEntitled: boolean): boolean {
  if (tier === 'free') return true
  if (tier === 'signup') return signedIn
  return paidEntitled
}

/**
 * Mobile-first, collapsible (issue #75 B7). Locked layers stay in the list —
 * dimmed with a lock icon, not hidden — clicking one does not switch the
 * map; MapsPageClient shows the gate prompt instead (see GateOverlay).
 */
export default function LayerPanel({
  activeLayerId,
  granularity,
  signedIn,
  paidEntitled,
  onSelectLayer,
  onSelectGranularity,
  compact,
}: Props) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-sm font-semibold text-foreground"
      >
        Layers
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-border p-3">
          {!compact && (
            <div className="mb-3 flex items-center gap-1 rounded-md border border-border p-1 text-xs">
              {(['county', 'zip'] as Granularity[]).map((g) => {
                const gateTier = GRANULARITY_GATE[g]
                const unlocked = isUnlocked(gateTier, signedIn, paidEntitled)
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onSelectGranularity(g)}
                    className={cn(
                      'flex min-h-8 flex-1 items-center justify-center gap-1 rounded px-2 py-1 font-medium',
                      granularity === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <MapPin className="size-3" aria-hidden />
                    {g === 'county' ? 'County' : 'ZIP'}
                    {!unlocked && <Lock className="size-3" aria-hidden />}
                  </button>
                )
              })}
            </div>
          )}

          <ul className="flex flex-col gap-1">
            {KPI_LAYERS.map((layer) => {
              const unlocked = isUnlocked(layer.tier, signedIn, paidEntitled)
              const active = layer.id === activeLayerId
              return (
                <li key={layer.id}>
                  <button
                    type="button"
                    onClick={() => onSelectLayer(layer.id)}
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                      active ? 'bg-secondary font-semibold text-foreground' : 'text-foreground hover:bg-secondary/60',
                      !unlocked && 'opacity-60'
                    )}
                  >
                    <span className="min-w-0 truncate">{layer.label}</span>
                    {!unlocked && <Lock className="size-3.5 shrink-0 text-primary" aria-hidden />}
                    {unlocked && !layer.hasData && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        No data
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
