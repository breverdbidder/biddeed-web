'use client'

import { useEffect, useRef, useState } from 'react'
import { Viewer } from 'mapillary-js'
import 'mapillary-js/dist/mapillary.css'

interface Props {
  imageId: string
}

// NEXT_PUBLIC_MAPILLARY_CLIENT_TOKEN is a public client token by design
// (Mapillary expects it in the browser) — same pattern as
// NEXT_PUBLIC_MAPBOX_TOKEN in D4DMap.tsx / AuctionMap.tsx.
export default function MapillaryViewer({ imageId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)

  const accessToken = process.env.NEXT_PUBLIC_MAPILLARY_CLIENT_TOKEN || ''

  useEffect(() => {
    if (!containerRef.current) return
    if (!accessToken) {
      setViewerError('Mapillary token not configured')
      return
    }
    setViewerError(null)
    const viewer = new Viewer({ accessToken, container: containerRef.current, imageId })
    viewerRef.current = viewer
    return () => {
      viewer.remove()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, accessToken])

  if (viewerError) {
    return (
      <div className="mt-3 flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-secondary text-center text-sm text-muted-foreground">
        {viewerError}
      </div>
    )
  }

  return <div ref={containerRef} className="mt-3 aspect-video w-full rounded-xl border border-border" />
}
