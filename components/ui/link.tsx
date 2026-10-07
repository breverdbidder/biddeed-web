import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import NextLink from 'next/link'

/**
 * next/link with background prefetching OFF by default (PageSpeed pass 3,
 * Ariel-approved 2026-10-07).
 *
 * Next prefetches every <Link> that scrolls into view: each one is a full
 * server render of the target route (RSC), fired before anyone clicks. The
 * sidebar alone carries ~15 links, so a single page view started ~24 of
 * those renders in the background - Worker CPU on our bill, main-thread work
 * and bandwidth on the visitor's phone, and (via the promo banner) enough
 * /subscribe hits to trip the checkout rate limiter (cli-anything-biddeed
 * a3ba36b). A click still navigates client-side; it just fetches on demand.
 *
 * Pass prefetch explicitly where a route is worth warming.
 */
const Link = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<typeof NextLink>>(function Link(
  { prefetch = false, ...props },
  ref
) {
  return <NextLink ref={ref} prefetch={prefetch} {...props} />
})

export default Link
