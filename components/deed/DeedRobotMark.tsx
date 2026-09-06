import { cn } from '@/lib/utils'
import { LIGHT as C } from '@/lib/design-tokens'

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
      className={cn('shrink-0', className)}
    >
      <circle cx="48" cy="10" r="6" fill={C.brand} />
      <path d="M48 16v8" stroke={C.brand} strokeWidth="5" strokeLinecap="round" />
      <rect x="14" y="22" width="68" height="52" rx="18" fill={C.navy} stroke={C.brand} strokeWidth="4" />
      <rect x="23" y="31" width="50" height="34" rx="12" fill={C.brandHover} />
      <circle cx="36" cy="45" r="6" fill={C.brand} />
      <circle cx="60" cy="45" r="6" fill={C.brand} />
      <path d="M37 56h22M42 56v5m12-5v5" stroke={C.brand} strokeWidth="3" strokeLinecap="round" />
      <path d="M48 74v8M34 86h28" stroke={C.brand} strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
