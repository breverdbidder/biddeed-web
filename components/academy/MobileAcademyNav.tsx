import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

import { source } from '@/lib/source'

interface TreeNode {
  type?: string
  name?: React.ReactNode
  url?: string
  index?: TreeNode
  children?: TreeNode[]
}

/**
 * Mobile-only Academy section nav (#63 mobile audit).
 *
 * The Fumadocs DocsLayout runs with its own nav bar disabled (AppShell owns
 * the top chrome), which on desktop is fine - the docs sidebar is always
 * visible at md+. But below md the sidebar has no trigger without the
 * Fumadocs nav bar, so phone readers had NO way to reach the page tree.
 * This renders the same tree as a native <details> disclosure, hidden from
 * md up where the real sidebar takes over. Server component: no client JS
 * beyond the disclosure element itself.
 */
export function MobileAcademyNav() {
  const children = (source.pageTree.children ?? []) as TreeNode[]
  return (
    <details className="group mb-6 rounded-xl border border-border bg-card md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        Academy sections
        <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <nav aria-label="Academy sections" className="border-t border-border px-2 py-2">
        <ul className="space-y-0.5">
          {children.map((node, i) => {
            if (node.type === 'folder') {
              return (
                <li key={i}>
                  <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {node.name}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {(node.children ?? []).map((leaf, j) =>
                      leaf.url ? (
                        <li key={j}>
                          <Link
                            href={leaf.url}
                            className="block rounded-md px-2 py-2 text-sm text-foreground hover:bg-secondary"
                          >
                            {leaf.name}
                          </Link>
                        </li>
                      ) : null
                    )}
                  </ul>
                </li>
              )
            }
            return node.url ? (
              <li key={i}>
                <Link
                  href={node.url}
                  className="block rounded-md px-2 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  {node.name}
                </Link>
              </li>
            ) : null
          })}
        </ul>
      </nav>
    </details>
  )
}
