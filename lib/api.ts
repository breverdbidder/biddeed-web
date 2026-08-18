/**
 * Client-side API URL builder.
 *
 * The app is mounted at basePath '/radar' so it can live behind the Cloudflare
 * Worker that still routes biddeed.ai. Next applies basePath automatically to
 * <Link>, next/image and router navigation -- but NOT to raw fetch(). A
 * component calling fetch('/api/auctions/summary') therefore requests
 * biddeed.ai/api/auctions/summary, which the Worker does not serve, and gets a
 * 404.
 *
 * That is not a theoretical bug. It silently broke every data call in
 * AuctionRadar -- summary, list, detail, map and calendar -- the moment
 * basePath was introduced. The page still returned HTTP 200, so curl-based
 * checks saw nothing wrong; only a real browser render surfaced it.
 *
 * Every client fetch of a first-party route goes through apiUrl().
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/radar'

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`
  // Guard against double-prefixing if a caller already included it.
  if (BASE_PATH && path.startsWith(`${BASE_PATH}/`)) return path
  return `${BASE_PATH}${path}`
}
