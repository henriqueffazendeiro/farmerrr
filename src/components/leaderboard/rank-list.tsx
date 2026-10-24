'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { ClipperRow } from '@/lib/db/board'
import { Avatar } from '@/components/ui/avatar'
import { compactNumber, fullNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

function Movement({ rank, previous }: { rank: number | null; previous: number | null }) {
  if (rank == null || previous == null || rank === previous) {
    return <Minus className="h-3 w-3 text-fg-subtle/50" strokeWidth={2} aria-hidden />
  }
  const up = previous > rank
  const delta = Math.abs(previous - rank)
  return (
    <span
      className={cn('nums inline-flex items-center gap-0.5 text-[11px]', up ? 'text-up' : 'text-down')}
      title={up ? `Subiu ${delta}` : `Desceu ${delta}`}
    >
      {up ? (
        <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
      ) : (
        <TrendingDown className="h-3 w-3" strokeWidth={2.5} />
      )}
      {delta}
    </span>
  )
}

export function RankList({
  clippers,
  slug,
  startAt = 0,
  ranked = true,
}: {
  clippers: ClipperRow[]
  slug: string
  /** Quantos saltar (o pódio já mostra os 3 primeiros). */
  startAt?: number
  /**
   * `true` quando a lista está pela ordem oficial do ranking — só então faz
   * sentido mostrar a posição guardada e as setas de subida/descida.
   */
  ranked?: boolean
}) {
  const rows = clippers.slice(startAt)
  if (rows.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface/60">
      {/* Cabeçalho — só onde há espaço */}
      <div className="hidden grid-cols-[2.5rem_1fr_6rem_6rem_5rem_4rem] items-center gap-3 border-b border-line/60 px-4 py-2.5 text-[11px] tracking-[0.08em] text-fg-subtle uppercase lg:grid">
        <span className="text-center">#</span>
        <span>Clipper</span>
        <span className="text-right">Views</span>
        <span className="text-right">Média / TikTok</span>
        <span className="text-right">Seguidores</span>
        <span className="text-right">Clips</span>
      </div>

      <ul className="divide-y divide-line/40">
        {rows.map((clipper, index) => {
          const position = ranked ? (clipper.rank ?? startAt + index + 1) : startAt + index + 1
          return (
            <motion.li
              key={clipper.participantId}
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            >
              <Link
                href={`/${slug}/c/${clipper.participantId}`}
                className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60 lg:grid-cols-[2.5rem_1fr_6rem_6rem_5rem_4rem]"
              >
                <span className="flex flex-col items-center gap-0.5">
                  <span className="nums text-sm font-medium text-fg-muted">{position}</span>
                  {ranked ? (
                    <Movement rank={clipper.rank} previous={clipper.previousRank} />
                  ) : null}
                </span>

                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={clipper.displayName} src={clipper.avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {clipper.displayName}
                    </span>
                    {clipper.username ? (
                      <span className="block truncate text-xs text-fg-subtle">
                        @{clipper.username}
                      </span>
                    ) : null}
                  </span>
                </span>

                {/* Compacto (mobile / tablet) */}
                <span className="text-right lg:hidden">
                  <span className="nums block text-sm font-semibold">
                    {compactNumber(clipper.totalViews)}
                  </span>
                  <span className="nums block text-xs text-fg-subtle">
                    {clipper.videoCount} clips
                  </span>
                </span>

                {/* Detalhado (desktop) */}
                <span className="nums hidden text-right text-sm font-semibold lg:block">
                  {fullNumber(clipper.totalViews)}
                </span>
                <span className="nums hidden text-right text-sm text-fg-muted lg:block">
                  {compactNumber(clipper.avgViews)}
                </span>
                <span className="nums hidden text-right text-sm text-fg-muted lg:block">
                  {clipper.followerCount == null ? '—' : compactNumber(clipper.followerCount)}
                </span>
                <span className="nums hidden text-right text-sm text-fg-muted lg:block">
                  {clipper.videoCount}
                </span>
              </Link>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
