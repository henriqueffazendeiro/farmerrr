import 'server-only'

import * as board from '@/lib/db/board'
import * as queries from '@/lib/db/queries'
import { supabaseConfigured } from '@/lib/config/env'
import { DEMO_ID, DEMO_SLUG, demoLeaderboard, demoCreator, demoClippers, demoRewards, demoVideos } from './demo'

export const isDemoLeaderboard = (id: string) => !supabaseConfigured && id === DEMO_ID

export async function getLeaderboardBySlug(slug: string) {
  if (!supabaseConfigured) return slug === DEMO_SLUG ? demoLeaderboard() : null
  return board.getLeaderboardBySlug(slug)
}

export async function getCreatorOf(lb: Parameters<typeof board.getCreatorOf>[0]) {
  return isDemoLeaderboard(lb.id) ? demoCreator() : board.getCreatorOf(lb)
}

export async function getClippers(id: string, periodKey: string) {
  return isDemoLeaderboard(id) ? demoClippers(periodKey) : board.getClippers(id, periodKey)
}

export async function getRewards(id: string) {
  return isDemoLeaderboard(id) ? demoRewards() : queries.getRewards(id)
}

export async function getLeaderboardTotals(id: string, periodKey: string) {
  if (!isDemoLeaderboard(id)) return queries.getLeaderboardTotals(id, periodKey)
  const rows = demoClippers(periodKey)
  const total_views = rows.reduce((sum, row) => sum + row.totalViews, 0)
  const total_clips = rows.reduce((sum, row) => sum + row.videoCount, 0)
  return { total_views, total_clips, active_clippers: rows.length,
    total_likes: rows.reduce((sum, row) => sum + row.totalLikes, 0),
    avg_views: Math.round(total_views / total_clips) }
}

export async function getVideos(lb: Parameters<typeof board.getVideos>[0], options: Parameters<typeof board.getVideos>[1]) {
  if (!isDemoLeaderboard(lb.id)) return board.getVideos(lb, options)
  let videos = demoVideos(options.periodKey)
  if (options.participantId) videos = videos.filter(video => video.participantId === options.participantId)
  if (options.orderBy === 'date') videos.sort((a, b) => b.published_at.localeCompare(a.published_at))
  return videos.slice(0, options.limit ?? 24)
}
