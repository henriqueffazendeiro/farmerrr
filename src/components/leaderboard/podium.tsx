import Link from 'next/link'
import { Crown } from 'lucide-react'
import type { ClipperRow } from '@/lib/db/board'
import type { Reward } from '@/lib/db/types'
import { Avatar } from '@/components/ui/avatar'
import { compactNumber, money } from '@/lib/format'
import { cn } from '@/lib/utils'

const STYLES = [
  {
    // 1.º
    ring: 'ring-gold/40',
    glow: '',
    tint: 'from-gold/8',
    text: 'text-gold',
    medal: '🥇',
  },
  {
    ring: 'ring-silver/30',
    glow: '',
    tint: 'from-silver/6',
    text: 'text-silver',
    medal: '🥈',
  },
  {
    ring: 'ring-bronze/30',
    glow: '',
    tint: 'from-bronze/8',
    text: 'text-bronze',
    medal: '🥉',
  },
] as const

function rewardText(reward: Reward | undefined): string | null {
  if (!reward) return null
  if (reward.amount_cents != null && reward.label) {
    return `${money(reward.amount_cents, reward.currency ?? 'EUR')} · ${reward.label}`
  }
  if (reward.amount_cents != null) return money(reward.amount_cents, reward.currency ?? 'EUR')
  return reward.label
}

export function Podium({
  clippers,
  rewards,
  slug,
}: {
  clippers: ClipperRow[]
  rewards: Reward[]
  slug: string
}) {
  const top = clippers.slice(0, 3)
  if (top.length === 0) return null

  // Desktop: 2.º — 1.º — 3.º. Mobile: 1.º, 2.º, 3.º pela ordem natural.
  const desktopOrder = [top[1], top[0], top[2]].filter(Boolean) as ClipperRow[]

  return (
    <>
      <div className="grid gap-3 sm:hidden">
        {top.map((clipper, index) => (
          <PodiumCard
            key={clipper.participantId}
            clipper={clipper}
            place={index}
            reward={rewards.find((r) => r.position === index + 1)}
            slug={slug}
          />
        ))}
      </div>

      <div className="hidden items-end gap-4 sm:grid sm:grid-cols-3">
        {desktopOrder.map((clipper) => {
          const place = top.findIndex((c) => c.participantId === clipper.participantId)
          return (
            <PodiumCard
              key={clipper.participantId}
              clipper={clipper}
              place={place}
              reward={rewards.find((r) => r.position === place + 1)}
              slug={slug}
              raised={place === 0}
            />
          )
        })}
      </div>
    </>
  )
}

function PodiumCard({
  clipper,
  place,
  reward,
  slug,
  raised = false,
}: {
  clipper: ClipperRow
  place: number
  reward?: Reward
  slug: string
  raised?: boolean
}) {
  const style = STYLES[place] ?? STYLES[2]
  const prize = rewardText(reward)

  return (
    <Link
      href={`/${slug}/c/${clipper.participantId}`}
      className={cn(
        'group relative block overflow-hidden rounded-xl bg-surface/80 p-5 text-center ring-1 ring-inset transition-transform duration-200 hover:-translate-y-0.5',
        style.ring,
        style.glow,
        raised && 'sm:-mt-8 sm:pt-8',
      )}
    >
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 bg-linear-to-b to-transparent', style.tint)}
      />

      <div className="relative">
        {place === 0 && (
          <Crown
            className="mx-auto mb-2 h-5 w-5 text-gold"
            strokeWidth={1.8}
            aria-hidden
          />
        )}

        <Avatar
          name={clipper.displayName}
          src={clipper.avatarUrl}
          size={raised ? 'xl' : 'lg'}
          className={cn('mx-auto ring-2 ring-offset-2 ring-offset-canvas', style.ring)}
        />

        <div className={cn('mt-3 text-2xl', !raised && 'text-xl')} aria-hidden>
          {style.medal}
        </div>

        <p className="mt-1 truncate text-sm font-semibold tracking-tight">
          {clipper.displayName}
        </p>
        {clipper.username ? (
          <p className="truncate text-xs text-fg-subtle">@{clipper.username}</p>
        ) : null}

        <p className={cn('nums mt-4 text-2xl font-semibold tracking-tight', style.text)}>
          {compactNumber(clipper.totalViews)}
        </p>
        <p className="nums mt-0.5 text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
          views · {clipper.videoCount} clips
        </p>

        {prize ? (
          <p className="mt-4 truncate rounded-sm border border-line bg-surface-2/80 px-3 py-1.5 text-[11px] font-medium text-fg-muted">
            {prize}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
