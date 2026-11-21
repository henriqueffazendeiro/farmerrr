import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PageReady } from '@/components/dashboard/page-ready'
import { StreamerLeaderboard } from '@/components/leaderboard/streamer-leaderboard'
import { demoCreator, demoLeaderboard } from '@/lib/leaderboards/demo'
import { availablePeriods } from '@/lib/period'

export const metadata: Metadata = { title: 'Pré-visualizar página pronta', robots: { index: false, follow: false } }

export default function ReadyPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  const leaderboard = demoLeaderboard()
  const periods = availablePeriods(leaderboard)
  return <>
    <StreamerLeaderboard leaderboard={leaderboard} creator={demoCreator()} clippers={[]} rewards={[]}
      totals={{ total_views: 0, total_clips: 0, active_clippers: 0, total_likes: 0, avg_views: 0 }}
      periods={periods} periodKey={periods[0]} sort="views" demo />
    <PageReady />
  </>
}
