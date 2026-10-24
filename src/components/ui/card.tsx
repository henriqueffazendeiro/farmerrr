import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface/80 backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5 pt-5 pb-3', className)} {...props} />
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-sm font-semibold tracking-tight text-fg', className)}
      {...props}
    />
  )
}
