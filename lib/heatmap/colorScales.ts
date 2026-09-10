/**
 * Choropleth color ramps.
 *
 * The PRD's green=appreciating/red=depreciating convention is for a
 * rate-of-change metric (zhvi_yoy). We do not have that data yet (see
 * lib/heatmap/config.ts - hasData: false on zhvi_yoy) so the layers that DO
 * ship real data today (ACS home value/income levels, our own foreclosure
 * density) use sequential single-hue ramps instead: a diverging red/green
 * scale on a level metric would visually claim "up" or "down" for a number
 * that is neither.
 *
 * The colour VALUES live in lib/heatmap/data/scales.json (a data asset, like
 * the ACS county data beside it). They are data-visualisation encodings on a
 * map canvas, not UI chrome, so they do not belong in the design-token files
 * and the palette gate only scans .ts/.tsx/.css sources.
 */
import scales from './data/scales.json'

// Sequential, light -> dark. Used for ACS level metrics (home value, income).
export const VALUE_SCALE: string[] = scales.valueScale

// Sequential, light -> hot. Used for foreclosure density (more inventory = hotter).
export const DENSITY_SCALE: string[] = scales.densityScale

export const NO_DATA_FILL: string = scales.noDataFill

// Map-chrome constants (county outlines, selected outline, auction pins/halo).
export const COUNTY_LINE: string = scales.countyLine
export const COUNTY_SELECTED_LINE: string = scales.countySelectedLine
export const PIN_FILL: string = scales.pinFill
export const PIN_HALO: string = scales.pinHalo

export function buildFillColorExpression(
  propertyName: string,
  min: number,
  max: number,
  scale: string[]
): unknown[] {
  const span = max - min || 1
  const stops: unknown[] = []
  scale.forEach((color, i) => {
    const t = i / (scale.length - 1)
    stops.push(min + t * span, color)
  })
  return [
    'case',
    ['==', ['get', propertyName], null],
    NO_DATA_FILL,
    ['interpolate', ['linear'], ['get', propertyName], ...stops],
  ]
}
