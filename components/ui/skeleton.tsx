import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10 motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

/**
 * The same placeholder as an inline <span>, for a value that is still loading
 * inside running text or a <dd>/<p> (a <div> there is invalid HTML). Always
 * aria-hidden: give the surrounding element its own accessible "loading" text.
 */
function SkeletonInline({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block animate-pulse rounded bg-primary/10 align-middle motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton, SkeletonInline }
