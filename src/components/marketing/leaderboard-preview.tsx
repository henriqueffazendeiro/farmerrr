'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Avatar } from '@/components/ui/avatar'
import { Badge, LiveDot } from '@/components/ui/badge'
import { compactNumber, fullNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type Row = { id: string; name: string; views: number }

const START: Row[] = [
  { id: 'joao', name: 'João', views: 8_421_930 },
  { id: 'miguel', name: 'Miguel', views: 6_821_420 },
  { id: 'pedro', name: 'Pedro', views: 4_192_183 },
  { id: 'diogo', name: 'Diogo', views: 2_831_921 },
  { id: 'andre', name: 'André', views: 1_942_820 },
]

const MEDALS = ['🥇', '🥈', '🥉'] as const
const MEDAL_RING = [
  'ring-gold/40 bg-gold/8',
  'ring-silver/30 bg-silver/6',
  'ring-bronze/30 bg-bronze/8',
] as const

/**
 * Demonstração viva na landing: as views sobem sozinhas e, quando alguém
 * ultrapassa outro, a linha desliza. É exatamente o que o produto faz.
 *
 * O `mode` troca só a escala: `stream` é a versão de ecrã inteiro, com a
 * tipografia grande que se lê do sofá.
 */
export function LeaderboardPreview({
  title = 'Summer Clip Wars',
  owner = 'por Luis Ferreira',
  mode = 'card',
  className,
}: {
  title?: string
  owner?: string
  mode?: 'card' | 'stream'
  className?: string
}) {
  const [rows, setRows] = useState<Row[]>(START)
  const reduced = useReducedMotion()
  const stream = mode === 'stream'

  useEffect(() => {
    if (reduced) return

    const timer = setInterval(() => {
      setRows((prev) => {
        // Cada clipper ganha views a um ritmo diferente; de vez em quando
        // um deles tem um clip a bombar.
        const next = prev.map((row) => {
          const spike = Math.random() < 0.18 ? 6 : 1
          const growth = Math.round((15_000 + Math.random() * 60_000) * spike)
          return { ...row, views: row.views + growth }
        })
        return next.sort((a, b) => b.views - a.views)
      })
    }, 1400)

    return () => clearInterval(timer)
  }, [reduced])

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-line',
        stream ? 'bg-canvas' : 'bg-surface/80',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b border-line/70',
          stream ? 'px-5 py-4 sm:px-6 sm:py-5' : 'px-4 py-3 sm:px-5',
        )}
      >
        <div className="min-w-0">
          <div
            className={cn(
              'truncate font-semibold tracking-tight',
              stream ? 'text-lg sm:text-2xl' : 'text-sm',
            )}
          >
            {title}
          </div>
          <div className={cn('truncate text-fg-subtle', stream ? 'text-xs sm:text-sm' : 'text-xs')}>
            {owner}
          </div>
        </div>
        <Badge tone="live">
          <LiveDot />
          Ao vivo
        </Badge>
      </div>

      <ul className="divide-y divide-line/50">
        <AnimatePresence initial={false}>
          {rows.map((row, index) => (
            <motion.li
              key={row.id}
              layout
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className={cn(
                'flex items-center',
                stream ? 'gap-4 px-5 py-3.5 sm:px-6 sm:py-4' : 'gap-3 px-4 py-3 sm:gap-4 sm:px-5',
                index < 3 && 'ring-1 ring-inset',
                index < 3 && MEDAL_RING[index],
              )}
            >
              <span
                className={cn(
                  'shrink-0 text-center',
                  stream ? 'w-8 text-xl sm:text-2xl' : 'w-6 text-base',
                )}
              >
                {index < 3 ? (
                  MEDALS[index]
                ) : (
                  <span className={cn('nums text-fg-subtle', stream ? 'text-lg' : 'text-sm')}>
                    {index + 1}
                  </span>
                )}
              </span>

              <Avatar name={row.name} size={stream ? 'md' : 'sm'} />

              <span
                className={cn(
                  'min-w-0 flex-1 truncate font-medium',
                  stream ? 'text-base sm:text-xl' : 'text-sm',
                )}
              >
                {row.name}
              </span>

              <span
                className={cn(
                  'nums shrink-0 font-semibold tabular-nums',
                  stream ? 'text-base sm:text-xl' : 'text-sm sm:text-[15px]',
                )}
              >
                <span className="sm:hidden">{compactNumber(row.views)}</span>
                <span className="hidden sm:inline">{fullNumber(row.views)}</span>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div
        className={cn(
          'border-t border-line/70 text-center text-fg-subtle',
          stream ? 'px-5 py-3 text-xs sm:px-6' : 'px-4 py-2.5 text-[11px] sm:px-5',
        )}
      >
        atualiza automaticamente
      </div>
    </div>
  )
}
