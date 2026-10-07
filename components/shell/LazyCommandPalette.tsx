'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

import { OPEN_COMMAND_PALETTE, isCommandPaletteShortcut } from './commandPaletteEvents'

const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false })

/**
 * Mounts the ⌘K command palette only when the visitor asks for it
 * (PageSpeed pass, 2026-10-07). The palette is closed on every page load, so
 * its code - Radix Dialog, the place and skill lists, the thread search - was
 * pure first-load weight. Pass 2: it no longer mounts on idle either; measured
 * live, that idle mount still cost ~100 ms of main thread inside the load
 * window on a throttled phone.
 *
 * The first ⌘K / Ctrl+K, or a click on the sidebar's Search row, mounts it
 * with initialOpen, so that first request opens the palette (after one small
 * chunk download) instead of being swallowed.
 */
export default function LazyCommandPalette() {
  const [mounted, setMounted] = useState(false)
  const [openOnMount, setOpenOnMount] = useState(false)

  useEffect(() => {
    if (mounted) return
    const openNow = () => {
      setOpenOnMount(true)
      setMounted(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (isCommandPaletteShortcut(e)) {
        e.preventDefault()
        openNow()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_COMMAND_PALETTE, openNow)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_COMMAND_PALETTE, openNow)
    }
  }, [mounted])

  return mounted ? <CommandPalette initialOpen={openOnMount} /> : null
}
