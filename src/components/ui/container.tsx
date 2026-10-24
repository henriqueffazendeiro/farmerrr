import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Largura de leitura confortável e legível numa stream a 1080p. */
export function Container({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-[1100px] px-5 sm:px-8', className)} {...props} />
}
