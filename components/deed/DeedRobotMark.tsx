import { cn } from '@/lib/utils'

interface Props {
  size?: number
  className?: string
  decorative?: boolean
}

export default function DeedRobotMark({ size = 32, className, decorative = true }: Props) {
  const label = decorative ? undefined : 'Deed Voice AI robot'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative ? true : undefined}
      className={cn('shrink-0 [&_.deed-accent]:fill-sidebar-primary [&_.deed-accent]:stroke-sidebar-primary [&_.deed-shell]:fill-sidebar [&_.deed-shell]:stroke-sidebar-primary [&_.deed-face]:fill-sidebar-accent', className)}
    >
      <circle className="deed-accent" cx="48" cy="10" r="6" />
      <path className="deed-accent" d="M48 16v8" strokeWidth="5" strokeLinecap="round" />
      <rect className="deed-shell" x="14" y="22" width="68" height="52" rx="18" strokeWidth="4" />
      <rect className="deed-face" x="23" y="31" width="50" height="34" rx="12" />
      <circle className="deed-accent" cx="36" cy="45" r="6" />
      <circle className="deed-accent" cx="60" cy="45" r="6" />
      <path className="deed-accent" d="M37 56h22M42 56v5m12-5v5" strokeWidth="3" strokeLinecap="round" />
      <path className="deed-accent" d="M48 74v8M34 86h28" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
