import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'brand' | 'live' | 'warning'

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2 text-fg-muted',
  brand: 'border-accent/25 bg-accent/10 text-accent',
  live: 'border-live/25 bg-live/10 text-live',
  warning: 'border-gold/25 bg-gold/10 text-gold',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

/** Ponto pulsante para o estado "ao vivo". */
export function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
    </span>
  )
}
