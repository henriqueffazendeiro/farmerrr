import 'server-only'
import { getClippers, getLeaderboardBySlug, getVideos } from '@/lib/leaderboards/public-data'
import { availablePeriods } from '@/lib/period'

export async function loadClipperDetails(slug: string, participantId: string, periodKey: string) {
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard || !availablePeriods(leaderboard).includes(periodKey)) return null
  // Em paralelo: os vídeos não dependem da validação do clipper.
  const [rows, videos] = await Promise.all([
    getClippers(leaderboard.id, periodKey),
    getVideos(leaderboard, { periodKey, participantId, limit: 60, orderBy: 'views' }),
  ])
  const clipper = rows.find(row => row.participantId === participantId && row.status === 'active')
  if (!clipper) return null
  return { clipper, videos }
}
