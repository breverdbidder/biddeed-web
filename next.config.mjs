/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]

const nextConfig = {
  // Mounted at biddeed.ai/radar/* behind the existing Cloudflare Worker, which
  // stays the edge router for the apex. basePath makes Next emit EVERY asset,
  // chunk and API path under /radar, so a single Worker proxy branch is enough
  // and none of the Worker's 40+ existing routes have to move.
  //
  // Without basePath the HTML would reference /_next/* at the apex, the Worker
  // would 404 those chunks, and the page would paint nothing - the same blank
  // shell this rebuild already fixed once via the CSP nonce.
  //
  // This also sidesteps the /auctions collision: the Worker serves GET /auctions
  // as a JSON API, and this app serves it as an HTML page. Under /radar they
  // never meet.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '/radar',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
