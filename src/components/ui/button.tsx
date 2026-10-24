import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'transition-[background-color,border-color,color,opacity] duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const variants: Record<Variant, string> = {
  // Lima sólido sobre preto — sem gradiente e sem sombra colorida.
  primary: 'bg-accent text-canvas hover:bg-brand-bright',
  secondary: 'bg-surface-2 text-fg border border-line hover:border-line-strong',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-transparent text-danger border border-danger/30 hover:bg-danger/10',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-xs',
  md: 'h-10 px-4 text-sm rounded-sm',
  lg: 'h-12 px-6 text-base rounded-sm',
}

type BaseProps = {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: BaseProps & ComponentProps<'button'>) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: BaseProps & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  )
}
