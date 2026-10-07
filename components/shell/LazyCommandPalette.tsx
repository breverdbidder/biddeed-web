'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

import { onIdle } from '@/lib/perf/idle'
import { OPEN_COMMAND_PALETTE, isCommandPaletteShortcut } from './commandPaletteEvents'

const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false })

/**
 * Mounts the ⌘K command palette after first paint instead of with it
 * (PageSpeed pass, 2026-10-07). The palette is closed on every page load, so
 * its code - Radix Dialog, the place and skill lists, the thread search - was
 * pure first-load weight.
 *
 * It mounts on whichever comes first: the browser going idle after load, or
 * the visitor actually asking for it (⌘K / Ctrl+K, or the sidebar's Search
 * row). A request that arrives before the mount still opens the palette:
 * it mounts with initialOpen, so the first ⌘K is never swallowed.
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
    const cancelIdle = onIdle(() => setMounted(true), 4000)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_COMMAND_PALETTE, openNow)
      cancelIdle()
    }
  }, [mounted])

  return mounted ? <CommandPalette initialOpen={openOnMount} /> : null
}
