/**
 * Compact zoning trust stamp (ZW-P0-002).
 * Links to /disclaimer; does not replace academy education Disclaimer.tsx.
 */
export default function ZoningDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p
      role="note"
      className={`text-[10px] leading-4 text-muted-foreground ${className}`.trim()}
    >
      Zoning and dimensional data are informational only — verify with the local jurisdiction before
      you rely on it.{' '}
      <a href="/disclaimer" className="font-semibold text-primary underline-offset-2 hover:underline">
        Full disclaimer
      </a>
    </p>
  )
}
