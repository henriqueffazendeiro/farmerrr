'use client'

import type { ReactNode } from 'react'
import { useLinkStatus } from 'next/link'
import { LoaderCircle } from 'lucide-react'

/** Lives inside a Link so feedback starts before the next route is ready. */
export function NavigationLabel({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus()

  return (
    <span className="relative inline-flex items-center" aria-busy={pending}>
      <span className={pending ? 'opacity-40' : undefined}>{children}</span>
      {pending && (
        <span role="status" className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          <span className="sr-only">A carregar…</span>
        </span>
      )}
    </span>
  )
}
