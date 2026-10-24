import Link from 'next/link'
import { cn } from '@/lib/utils'

export type TabItem = { key: string; label: string; href: string }

/** Separadores usados para período e ordenação. */
export function Tabs({ items, active }: { items: TabItem[]; active: string }) {
  if (items.length <= 1) return null

  return (
    <div className="inline-flex gap-1 rounded-sm border border-line bg-surface-2/60 p-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          className={cn(
            'rounded-sm px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
            item.key === active
              ? 'bg-surface-3 text-fg'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}
