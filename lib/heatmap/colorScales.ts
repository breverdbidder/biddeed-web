/**
 * Choropleth color ramps.
 *
 * The PRD's green=appreciating/red=depreciating convention is for a
 * rate-of-change metric (zhvi_yoy). We do not have that data yet (see
 * lib/heatmap/config.ts — hasData: false on zhvi_yoy) so the layers that DO
 * ship real data today (ACS home value/income levels, our own foreclosure
 * density) use sequential single-hue ramps instead: a diverging red/green
 * scale on a level metric would visually claim "up" or "down" for a number
 * that is neither.
 */

// Sequential, light -> dark. Used for ACS level metrics (home value, income).
export const VALUE_SCALE = ['#eef2ff', '#c7d2fe', '#818cf8', '#4f46e5', '#312e81']

// Sequential, light -> hot. Used for foreclosure density (more inventory = hotter).
export const DENSITY_SCALE = ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c', '#7c2d12']

export const NO_DATA_FILL = '#e5e7eb'

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
