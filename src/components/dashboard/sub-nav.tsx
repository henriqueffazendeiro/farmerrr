'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { segment: '', label: 'Visão geral' },
  { segment: '/clippers', label: 'Clippers' },
  { segment: '/videos', label: 'Vídeos' },
  { segment: '/definicoes', label: 'Definições' },
] as const

export function SubNav({ basePath }: { basePath: string }) {
  const pathname = usePathname()

  return (
    <nav className="mt-7 flex gap-1 overflow-x-auto border-b border-line/60">
      {TABS.map((tab) => {
        const href = `${basePath}${tab.segment}`
        const active = pathname === href
        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              '-mb-px border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
              active
                ? 'border-brand font-medium text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
