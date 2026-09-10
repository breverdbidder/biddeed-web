import { FREE_LAYER_ID, KPI_LAYERS, type Granularity } from './config'
import type { HeatmapUrlState } from './types'

/**
 * Shareable state lives in three query params: layer, gran, sel. Reventure's
 * map does not encode state into the URL at all (verified 2026-09-10) — a
 * shared /maps link here must reproduce the exact view, so every param is
 * validated against a closed set rather than trusted as free text.
 */
export function parseHeatmapSearchParams(
  params: Record<string, string | string[] | undefined>
): HeatmapUrlState {
  const rawLayer = typeof params.layer === 'string' ? params.layer : undefined
  const layer = rawLayer && KPI_LAYERS.some((l) => l.id === rawLayer) ? rawLayer : FREE_LAYER_ID

  const rawGran = typeof params.gran === 'string' ? params.gran : undefined
  const granularity: Granularity = rawGran === 'zip' ? 'zip' : 'county'

  const rawSel = typeof params.sel === 'string' ? params.sel : undefined
  const selected =
    granularity === 'county'
      ? rawSel && /^\d{3}$/.test(rawSel) ? rawSel : null
      : rawSel && /^\d{5}$/.test(rawSel) ? rawSel : null

  return { layer, granularity, selected }
}

export function buildHeatmapSearchParams(state: HeatmapUrlState): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set('layer', state.layer)
  sp.set('gran', state.granularity)
  if (state.selected) sp.set('sel', state.selected)
  return sp
}

export function heatmapStateToPath(base: '/maps', state: HeatmapUrlState): string {
  return `${base}?${buildHeatmapSearchParams(state).toString()}`
}
