'use server'

import { getClippers, getLeaderboardBySlug, getVideos } from '@/lib/leaderboards/public-data'
import { availablePeriods } from '@/lib/period'

export async function getClipperDetails(slug: string, participantId: string, periodKey: string) {
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard || !availablePeriods(leaderboard).includes(periodKey)) throw new Error('Ranking indisponível')
  const rows = await getClippers(leaderboard.id, periodKey)
  const clipper = rows.find(row => row.participantId === participantId && row.status === 'active')
  if (!clipper) throw new Error('Clipper indisponível')
  const videos = await getVideos(leaderboard, { periodKey, participantId, limit: 60, orderBy: 'views' })
  return { clipper, videos }
}
