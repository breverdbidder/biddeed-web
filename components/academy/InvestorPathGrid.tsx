import { INVESTOR_PATHS } from '@/lib/investor-paths'

export function InvestorPathGrid() {
  return <div className="not-prose my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {INVESTOR_PATHS.map((path) => <article id={path.id} key={path.id} className="scroll-mt-24 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{path.stage}</p><span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">{path.tier}</span></div>
      <h2 className="mt-2 text-lg font-bold text-foreground">{path.title}</h2><p className="mt-2 text-base leading-6 text-muted-foreground">{path.summary}</p>
      <div className="mt-4 flex flex-wrap gap-3"><a className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href={path.academyHref}>Learn the path</a><a className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href={path.workspaceHref}>Open the tool</a></div>
    </article>)}
  </div>
}
