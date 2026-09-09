import { defineConfig, defineDocs, frontmatterSchema } from 'fumadocs-mdx/config'
import { z } from 'zod'

/**
 * BidDeed Academy content (#63).
 *
 * One collection, mounted at /academy. Everything in it is PUBLIC today —
 * middleware.ts allowlists /academy(.*) and nothing here reads a session.
 *
 * `tier` is forward-looking metadata only (Ariel's monetization plan):
 *   public  — Tax Deeds 101, Foreclosures 101, start-here, glossary
 *   free    — full How-to-use-BidDeed, basic county playbooks (needs a free account, later)
 *   signal  — SIGNAL$ literacy / read-your-report module (report buyers, later)
 *   investor— case studies, advanced playbooks, lien-priority / max-bid / ML lessons (later)
 * Nothing gates on it yet. When the free/Investor gates are wired, filter the
 * page tree on this field instead of moving files — the directory layout below
 * already separates the tiers by section.
 */
export const academy = defineDocs({
  dir: 'content/academy',
  docs: {
    schema: frontmatterSchema.extend({
      tier: z.enum(['public', 'free', 'signal', 'investor']).default('public'),
    }),
  },
})

export default defineConfig()
