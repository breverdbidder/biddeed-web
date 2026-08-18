'use client'

import { getZoningCategory, ZONING_CATEGORY_COLORS, ZONING_CATEGORY_LABELS, type ZoningCategory } from '@/lib/zoning'

interface Props {
  dorCode: string | null | undefined
  category?: ZoningCategory | null
  size?: 'sm' | 'md'
}

/**
 * ZoningBadge — Displays a colored badge for a property's zoning category.
 *
 * Can accept either a DOR code (will auto-classify) or a pre-computed category.
 */
export default function ZoningBadge({ dorCode, category, size = 'sm' }: Props) {
  const cat = category || getZoningCategory(dorCode)
  if (!cat) return <span className="text-gray-400 dark:text-slate-600 text-xs">—</span>

  const colors = ZONING_CATEGORY_COLORS[cat]
  const label = ZONING_CATEGORY_LABELS[cat]

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center rounded font-semibold ${sizeClasses} ${colors.bg} ${colors.text}`}
      title={label}
    >
      {cat}
    </span>
  )
}
