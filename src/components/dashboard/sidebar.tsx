'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Settings, Trophy } from 'lucide-react'
import { Wordmark } from '@/components/ui/wordmark'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/dashboard', label: 'Leaderboards', icon: Trophy, exact: true },
  { href: '/dashboard/conta', label: 'Conta', icon: Settings, exact: false },
] as const

export function Sidebar({ creatorName }: { creatorName: string | null }) {
  const pathname = usePathname()

  return (
    <aside className="flex shrink-0 flex-col gap-1 border-line/60 md:h-dvh md:w-60 md:border-r md:p-4">
      <Link href="/" className="mb-6 hidden px-2 pt-2 md:block">
        <Wordmark />
      </Link>

      {creatorName ? (
        <div className="mb-4 hidden items-center gap-2 rounded-sm border border-line bg-surface-2 px-3 py-2 md:flex">
          <LayoutGrid className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={2} />
          <span className="truncate text-sm text-fg-muted">{creatorName}</span>
        </div>
      ) : null}

      <nav className="flex gap-1 overflow-x-auto border-b border-line/60 px-4 py-2 md:flex-col md:overflow-visible md:border-0 md:p-0">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm whitespace-nowrap transition-colors',
                active
                  ? 'bg-surface-2 font-medium text-fg'
                  : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
              )}
            >
              <link.icon className="h-4 w-4" strokeWidth={2} />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
