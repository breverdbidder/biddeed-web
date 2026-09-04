'use client'

import { formatCountyLabel } from '@/lib/counties'
import type { ViewMode } from '@/types/auctions'

/**
 * The zoning dropdown was removed on Aug 17 2026. multi_county_auctions has no
 * zoning_category column, so selecting a zone sent zoning_category= to
 * /api/auctions and produced a hard 500 - the control could never have worked.
 * Real zoning filtering requires joining auctions to zoning_assignments and is
 * tracked as its own piece of work; shipping a control that silently does
 * nothing is worse than not shipping it.
 */

interface Props {
  counties: string[]
  selectedCounty: string
  selectedType: string
  viewMode: ViewMode
  onCountyChange: (county: string) => void
  onTypeChange: (type: string) => void
  onViewModeChange: (mode: ViewMode) => void
}

export default function AuctionFilters({
  counties,
  selectedCounty,
  selectedType,
  viewMode,
  onCountyChange,
  onTypeChange,
  onViewModeChange,
}: Props) {
  // min-w-0 + max-w-full: the county list contains long names, and without
  // them the select sizes to its widest option and spills out of the filter
  // row at 320px (measured: 59px past a 288px container).
  // min-h-11 is the WCAG 2.5.8 touch size, dropped back to auto at md.
  const selectClass = 'px-3 py-1.5 min-h-11 md:min-h-0 min-w-0 max-w-full text-sm bg-card dark:bg-card border border-border dark:border-border rounded-md text-foreground dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={selectedCounty}
        onChange={(e) => onCountyChange(e.target.value)}
        className={selectClass}
      >
        <option value="">All Counties</option>
        {counties.map((c) => (
          <option key={c} value={c}>{formatCountyLabel(c)}</option>
        ))}
      </select>

      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        className={selectClass}
      >
        <option value="">All Types</option>
        <option value="foreclosure">Foreclosure</option>
        <option value="tax_deed">Tax Deed</option>
      </select>

      {/* w-full + overflow-x-auto: at 320-393px the four labels (esp. "Spreadsheet")
          don't fit bg-muted's fixed padding, and this pill wraps onto its own
          flex-wrap line with nothing to shrink against - it was clipping "Spreadsheet"
          off the right edge of the screen with no way to reach it (measured: 59px
          past a 288px container). Scrolling beats clipping when there's truly no room. */}
      <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-0.5 bg-muted dark:bg-card rounded-md p-0.5 overflow-x-auto">
        {(['split', 'table', 'map', 'calendar', 'spreadsheet'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            // Every label is bold and full-contrast black (white in dark mode),
            // not thin gray. This row is the view switcher for the Auctions
            // workspace only - primary navigation is the shell's nav rail, and
            // this control no longer stands in for it. Because
            // colour no longer distinguishes the selected tab, the active pill
            // carries the state via background + shadow, and hover moved from a
            // colour shift to a background wash.
            className={`px-2.5 sm:px-3.5 py-1.5 text-sm font-bold rounded transition-colors whitespace-nowrap shrink-0 ${
              viewMode === mode
                ? 'bg-card dark:bg-muted text-foreground dark:text-white shadow-sm'
                : 'text-foreground dark:text-white hover:bg-card/60 dark:hover:bg-muted/60'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
