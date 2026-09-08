import { ImageResponse } from 'next/og'
import { LIGHT } from '@/lib/design-tokens'

// Default social-share card for every route that does not define its own
// (none do today — see app/layout.tsx metadata comment). Generated at build
// time via Next's built-in OG image convention, no extra dependency.
export const alt = 'BidDeed.AI — Auction Intelligence'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: LIGHT.background,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 112,
            height: 112,
            borderRadius: 24,
            backgroundColor: LIGHT.brand,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <span style={{ color: LIGHT.background, fontSize: 64, fontWeight: 800 }}>B</span>
        </div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: LIGHT.navy }}>
          Bid<span style={{ color: LIGHT.brand }}>Deed</span>.AI
        </div>
        <div style={{ display: 'flex', marginTop: 22, fontSize: 30, color: LIGHT.navy }}>
          Auction Intelligence for Florida Foreclosure &amp; Tax Deed Sales
        </div>
      </div>
    ),
    { ...size }
  )
}
