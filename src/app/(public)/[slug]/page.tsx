import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { StreamerLeaderboard } from '@/components/leaderboard/streamer-leaderboard'
import { getClippers, getCreatorOf, getLeaderboardBySlug, getLeaderboardTotals, getRewards, getVideos, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { ALL_TIME, availablePeriods } from '@/lib/period'
import { getCreatorLives } from '@/lib/streams/data'

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ periodo?: string; ordem?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const lb = await getLeaderboardBySlug(slug)
  if (!lb) return { title: 'Ranking não encontrado' }
  return { title: lb.name, description: lb.description,
    ...(isDemoLeaderboard(lb.id) ? { robots: { index: false, follow: false } } : {}) }
}

export default async function PublicLeaderboardPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { periodo, ordem } = await searchParams
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) notFound()
  const periods = availablePeriods(leaderboard)
  const periodKey = ordem !== 'media' && periodo && periods.includes(periodo) ? periodo : periods[0]
  const [creator, clippers, totals, rewards, videos, allVideos, lives] = await Promise.all([
    getCreatorOf(leaderboard), getClippers(leaderboard.id, periodKey),
    getLeaderboardTotals(leaderboard.id, periodKey), getRewards(leaderboard.id),
    getVideos(leaderboard, { periodKey, limit: 24 }),
    getVideos(leaderboard, { periodKey: ALL_TIME, limit: 24 }),
    isDemoLeaderboard(leaderboard.id) ? Promise.resolve([]) : getCreatorLives(leaderboard.creator_id, leaderboard.timezone),
  ])
  return <StreamerLeaderboard leaderboard={leaderboard} creator={creator}
    clippers={clippers.filter(c => c.status === 'active')} totals={totals} rewards={rewards}
    videos={videos} allVideos={allVideos} periods={periods} periodKey={periodKey}
    sort={ordem === 'media' ? 'media' : 'views'} demo={isDemoLeaderboard(leaderboard.id)} lives={lives} isLive={lives.some(live => live.isLive)} />
}
