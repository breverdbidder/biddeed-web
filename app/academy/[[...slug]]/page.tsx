import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import { source } from '@/lib/source'
import { getMDXComponents } from '@/mdx-components'

interface Props {
  params: Promise<{ slug?: string[] }>
}

/**
 * No generateStaticParams on purpose: app/layout.tsx is force-dynamic because
 * the CSP nonce is minted per request (see middleware.ts — a prerendered page
 * can never carry one), and that layout flag covers this catch-all.
 */
export default async function AcademyPage({ params }: Props) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description ? <DocsDescription>{page.data.description}</DocsDescription> : null}
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const canonical = page.url
  return {
    title: `${page.data.title} | BidDeed Academy`,
    description: page.data.description,
    alternates: { canonical: `https://biddeed.ai${canonical}` },
  }
}
