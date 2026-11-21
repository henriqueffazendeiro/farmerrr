'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NavigationLabel } from './navigation-label'

const TABS = [
  { segment: '', label: 'Visão geral' },
  { segment: '/clippers', label: 'Clippers' },
  { segment: '/videos', label: 'Vídeos' },
  { segment: '/definicoes', label: 'Definições' },
] as const

export function SubNav({ basePath }: { basePath: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Gestão da página" className="mt-10 flex gap-6 overflow-x-auto border-b border-line/60 sm:gap-8">
      {TABS.map((tab) => {
        const href = `${basePath}${tab.segment}`
        const active = pathname === href
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'border-b-2 py-3 text-sm whitespace-nowrap transition-colors',
              active
                ? 'border-brand font-medium text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            <NavigationLabel>{tab.label}</NavigationLabel>
          </Link>
        )
      })}
    </nav>
  )
}
