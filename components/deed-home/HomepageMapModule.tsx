'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/scoring'
import { trackHeatmapEvent } from '@/lib/analytics/track'
import acsData from '@/lib/heatmap/data/fl-county-acs-2024.json'
import type { CountyAcsDataset } from '@/lib/heatmap/types'

const ACS = acsData as unknown as CountyAcsDataset

const HomepageMapInteractive = dynamic(() => import('@/components/heatmap/HomepageMapInteractive'), {
  ssr: false,
  loading: () => (
    <div className="h-[42vh] w-full animate-pulse rounded-lg border border-border bg-secondary/40 sm:h-[360px]" />
  ),
})

/**
 * Homepage compact map (issue #75 Amendment 2): "Florida Auction
 * Intelligence Map", directly below the Ask Deed hero, before the long
 * proof/story sections. Real content on first paint — the county count and
 * statewide median home value are real ACS figures, not placeholders — with
 * the heavy Mapbox bundle lazy-loaded only once this section scrolls into
 * view, so it never competes with the hero for first paint.
 */
export default function HomepageMapModule() {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          trackHeatmapEvent('homepage_map_view', { surface: 'homepage', kpi_layer: 'market_direction' })
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-medium tracking-tight text-foreground sm:text-2xl">
          Florida Auction Intelligence Map
        </h2>
        <a
          href="/maps"
          onClick={() => trackHeatmapEvent('homepage_to_maps_click', { surface: 'homepage' })}
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 sm:flex"
        >
          Full map <ArrowRight className="size-3.5" aria-hidden />
        </a>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Live foreclosure and tax deed auction pins over county market direction — {ACS.counties.length} Florida
        counties, median home value {formatCurrency(ACS.statewide.median_home_value)} statewide.{' '}
        <span className="text-muted-foreground/70">{ACS.vintage_label}, {ACS.tables['B25077']}.</span>
      </p>

      <div className="mt-4">
        {visible ? (
          <HomepageMapInteractive />
        ) : (
          <div className="h-[42vh] w-full animate-pulse rounded-lg border border-border bg-secondary/40 sm:h-[360px]" />
        )}
      </div>
    </section>
  )
}
