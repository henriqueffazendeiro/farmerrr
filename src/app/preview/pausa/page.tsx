import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { OwnerPausedOverlay } from '@/components/billing/paused'
import { StreamerLeaderboard } from '@/components/leaderboard/streamer-leaderboard'
import { demoCreator, demoLeaderboard } from '@/lib/leaderboards/demo'
import { availablePeriods } from '@/lib/period'

export const metadata: Metadata = { title: 'Pré-visualizar página em pausa', robots: { index: false, follow: false } }

/** Só em desenvolvimento: o aviso que o dono vê quando a página está em pausa. */
export default function PausedPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  const leaderboard = demoLeaderboard()
  const periods = availablePeriods(leaderboard)
  return <>
    <StreamerLeaderboard leaderboard={leaderboard} creator={demoCreator()} clippers={[]} rewards={[]}
      totals={{ total_views: 0, total_clips: 0, active_clippers: 0, total_likes: 0, avg_views: 0 }}
      periods={periods} periodKey={periods[0]} sort="views" demo />
    <OwnerPausedOverlay slug="preview" />
  </>
}
