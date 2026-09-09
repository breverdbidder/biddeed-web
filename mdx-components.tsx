import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'
import { BidDeedCTA } from '@/components/academy/BidDeedCTA'
import { SaleTypeCallout } from '@/components/academy/SaleTypeCallout'
import { Disclaimer } from '@/components/academy/Disclaimer'
import { Checklist } from '@/components/academy/Checklist'

/**
 * MDX components available to every Academy page (#63). The four BidDeed
 * components are the issue-specified set; the fumadocs defaults cover
 * Callout / Card / Cards / code blocks.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    BidDeedCTA,
    SaleTypeCallout,
    Disclaimer,
    Checklist,
    ...components,
  }
}
