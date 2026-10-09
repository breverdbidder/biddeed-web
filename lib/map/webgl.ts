/**
 * WebGL availability for the Mapbox surfaces.
 *
 * Mapbox GL JS 3.x (3.28.1 in the lockfile) draws with WebGL 2 only, and
 * `new mapboxgl.Map()` THROWS synchronously when it cannot get a context.
 * Inside a React effect that throw reached the route error boundary, which
 * retried three times at 15 s intervals behind a spinner and never rendered
 * a single auction (REA teardown, 2026-10-09: "Error: Failed to initialize
 * WebGL" on /radar and on the homepage map module). WebGL is off for real
 * visitors more often than it looks: hardware acceleration disabled, remote
 * desktops and VMs, locked-down work machines, some privacy browsers.
 *
 * Every map component now checks this first and also wraps the constructor,
 * then renders NO_WEBGL_MESSAGE in place of the canvas, so the rest of the
 * page (lists, calendar, cards) keeps working.
 */
export const NO_WEBGL_MESSAGE =
  "This browser can't draw the map because WebGL is turned off or unavailable. Every auction is still in the list and calendar views."

let cached: boolean | null = null

export function webglAvailable(): boolean {
  if (cached !== null) return cached
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null
    cached = !!gl
    // Hand the probe context back immediately; browsers cap live contexts.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}

/**
 * Construct a map without letting a WebGL failure escape the effect. Returns
 * null (and logs once) when the browser cannot draw; the caller shows
 * NO_WEBGL_MESSAGE instead.
 */
export function createMapSafely<T>(create: () => T): T | null {
  if (!webglAvailable()) return null
  try {
    return create()
  } catch (err) {
    console.warn('[map] could not initialise Mapbox:', err instanceof Error ? err.message : err)
    return null
  }
}
