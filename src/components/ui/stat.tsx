import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Bloco de estatística. Número grande primeiro, rótulo pequeno em baixo —
 * legível de longe quando o streamer mostra a página numa live.
 */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="nums truncate text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium tracking-[0.08em] text-fg-subtle uppercase">
        {label}
      </div>
      {hint ? <div className="mt-1 text-xs text-fg-muted">{hint}</div> : null}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-6">{children}</div>
  )
}
