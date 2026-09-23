import { Banknote, Gavel, Hammer, Home, Landmark, MapPinned, Wand2 } from 'lucide-react'

import type { SlashCommand } from '@/components/deed/SlashMenu'

/**
 * The /chat composer's slash menu (PARITY CP-6): every entry opens the Skills
 * panel with that skill chosen, so each one is wired, per SlashMenu's rule.
 */
export const SKILL_COMMANDS: SlashCommand[] = [
  { name: 'skills', label: '/skills', hint: 'Open the skills library', icon: Wand2 },
  { name: 'liens', label: '/liens', hint: 'Lien survival: which recorded liens survive the sale', icon: Landmark },
  { name: 'surplus', label: '/surplus', hint: 'Surplus check: sale price against the judgment', icon: Banknote },
  { name: 'zoning', label: '/zoning', hint: 'Zoning district, setbacks, density and ordinance', icon: MapPinned },
  { name: 'comps', label: '/comps', hint: 'Comparable sales in the same ZIP since 2022', icon: Home },
  { name: 'repairs', label: '/repairs', hint: 'Repair estimate from catalog unit costs', icon: Hammer },
  { name: 'maxbid', label: '/maxbid', hint: 'The recorded numbers a max bid is built from', icon: Gavel },
]

/** Slash command name → the skill the panel opens on (null = the library). */
export const SKILL_COMMAND_TARGET: Record<string, string | null> = {
  skills: null,
  liens: 'lien_survival',
  surplus: 'surplus_check',
  zoning: 'zoning',
  comps: 'comps',
  repairs: 'repair_estimate',
  maxbid: 'max_bid',
}
