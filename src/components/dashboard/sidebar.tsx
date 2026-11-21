'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Settings2, UserRound } from 'lucide-react'
import { BrandLogo } from '@/components/ui/brand-logo'
import { cn } from '@/lib/utils'
import { NavigationLabel } from './navigation-label'

export function Sidebar({ creatorName, leaderboard }: {
  creatorName: string | null
  leaderboard: { id: string; slug: string } | null
}) {
  const pathname = usePathname()
  const base = leaderboard ? `/dashboard/l/${leaderboard.id}` : '/dashboard/novo'
  const links = leaderboard ? [
    { href: `${base}/definicoes`, label: 'Competição', icon: Settings2 },
  ] : [
    { href: creatorName ? '/dashboard/novo' : '/dashboard/inicio', label: 'Criar página', icon: Settings2 },
  ]

  return (
    <aside className="min-w-0 border-b border-line/60 px-5 py-5 md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:px-6 md:py-10">
      <div className="flex items-center justify-between gap-4 md:block">
        <Link href="/" aria-label="farmerrr — página inicial" className="inline-flex"><BrandLogo /></Link>
        {creatorName && <p className="truncate text-xs text-fg-subtle md:mt-8">{creatorName}</p>}
      </div>
      <nav aria-label="Área do criador" className="mt-5 flex gap-1 overflow-x-auto pb-1 md:mt-4 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}
            className={cn('flex shrink-0 items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
              pathname === link.href ? 'bg-surface-2 font-medium text-fg' : 'text-fg-muted hover:bg-surface/70 hover:text-fg')}>
            <link.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <NavigationLabel>{link.label}</NavigationLabel>
          </Link>
        ))}
        <div className="flex shrink-0 gap-1 md:mt-auto md:flex-col md:border-t md:border-line/60 md:pt-4">
          {leaderboard && <Link href={`/${leaderboard.slug}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm whitespace-nowrap text-fg-muted transition-colors hover:text-fg">
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />Ver página
          </Link>}
          <Link href="/dashboard/conta" aria-current={pathname === '/dashboard/conta' ? 'page' : undefined}
            className={cn('flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm transition-colors',
              pathname === '/dashboard/conta' ? 'bg-surface-2 font-medium text-fg' : 'text-fg-muted hover:text-fg')}>
            <UserRound className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            <NavigationLabel>Conta</NavigationLabel>
          </Link>
        </div>
      </nav>
    </aside>
  )
}
