import type { ReactNode } from 'react'

export function PrizeAmount({ blur, children }: { blur?: boolean; children: ReactNode }) {
  if (!blur) return <>{children}</>
  return <span aria-label="Quantia por revelar">
    <span aria-hidden="true">...</span>
  </span>
}
