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
  // Inlined at build time so /api/health can report which commit is serving.
  // GITHUB_SHA is set on the runner where `vercel build` executes; locally it
  // is absent and the route reports 'dev'. The CI smoke check polls the
  // production alias until this value matches the SHA it just deployed --
  // without it, asserting the alias would happily pass against the PREVIOUS
  // deployment and a failed promotion would look green.
  env: { BUILD_SHA: process.env.GITHUB_SHA ?? 'dev' },
  // The app now serves the apex. basePath is empty, so Next emits assets at
  // /_next/* and the Worker gains explicit proxy branches for /, /_next/*,
  // /api/*, /radar* and /success rather than one /radar branch.
  //
  // NEXT_PUBLIC_BASE_PATH stays configurable so the mount can move again
  // without a code change. lib/api.ts reads the same variable, because
  // basePath is never applied to raw fetch() - see the comment there.
  //
  // GET /auctions is a JSON API on the Worker. With basePath gone that
  // collision is live, so nothing in this app may claim /auctions: the
  // auctions workspace is a real route at /radar.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Legacy in-app links. While the app was mounted at basePath '/radar' the
  // workspace lived at /radar/auctions and details at /radar/auctions/:id.
  // Both moved up a level. These redirects are scoped under /radar on purpose:
  // the apex /auctions must never be claimed by this app, because the Worker
  // serves it as a JSON API.
  async redirects() {
    return [
      { source: '/radar/auctions', destination: '/radar', permanent: true },
      { source: '/radar/auctions/:id', destination: '/radar/:id', permanent: true },
    ]
  },
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
