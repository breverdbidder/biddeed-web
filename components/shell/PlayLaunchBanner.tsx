'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

/**
 * Site-wide Play launch promo strip for BidDeed Field soft launch.
 *
 * Offer: pay 1 month of Pro ($199), get 2 free (`MVP_PLAY_LAUNCH`).
 * Dismissed per-device via localStorage so return visitors are not nagged;
 * storage failures leave the banner visible for the session only.
 *
 * Hidden on Clerk auth routes — those pages own a centered layout and must
 * not compete with sign-in / sign-up controls (same rule as StickyDeedCta).
 */
const STORAGE_KEY = 'biddeed.playLaunchBanner.v1'
const CTA_HREF = '/subscribe?promo=MVP_PLAY_LAUNCH&tier=pro'

export default function PlayLaunchBanner() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  const isAuthRoute =
    pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')

  useEffect(() => {
    if (isAuthRoute) {
      setVisible(false)
      return
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'dismissed') {
        setVisible(false)
        return
      }
    } catch {
      /* storage unavailable — show for this visit */
    }
    setVisible(true)
  }, [isAuthRoute])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'dismissed')
    } catch {
      /* storage unavailable — stays hidden for this page only */
    }
  }

  if (!visible || isAuthRoute) return null

  return (
    <div
      role="region"
      aria-label="Play launch offer"
      className="relative z-10 flex items-center gap-2 border-b border-primary/20 bg-primary px-3 py-2 text-primary-foreground sm:px-4"
    >
      <p className="min-w-0 flex-1 text-center text-sm font-medium leading-5">
        <Link
          href={CTA_HREF}
          className="underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
        >
          Play launch: Pay 1 month of Pro ($199), get 2 free → Subscribe
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss Play launch banner"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary-foreground outline-none transition-colors hover:bg-primary-foreground/15 focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}
