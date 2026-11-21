import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { HISTORY_PERIOD } from '@/lib/period'

type MetricVideo = {
  id: string; social_account_id: string; latest_views: number; latest_likes: number;
  latest_comments: number; latest_shares: number
}

export function historyMetrics(videos: MetricVideo[], excluded: Set<string>) {
  const valid = videos.filter(v => !excluded.has(v.id))
  const total_views = valid.reduce((n, v) => n + v.latest_views, 0)
  const best = [...valid].sort((a, b) => b.latest_views - a.latest_views || a.id.localeCompare(b.id))[0]
  return { total_views, total_likes: valid.reduce((n, v) => n + v.latest_likes, 0),
    total_comments: valid.reduce((n, v) => n + v.latest_comments, 0),
    total_shares: valid.reduce((n, v) => n + v.latest_shares, 0),
    video_count: valid.length, avg_views: valid.length ? Math.floor(total_views / valid.length) : 0,
    best_video_id: best?.id ?? null }
}

/** Materialize only the affected participant's history; never rescan all 300 accounts per sync. */
export async function recomputeHistoryForAccount(admin: SupabaseClient<Database>, accountId: string) {
  const { data: account, error: accountError } = await admin.from('social_accounts')
    .select('clipper_profile_id').eq('id', accountId).maybeSingle()
  if (accountError) throw accountError
  if (!account) return
  const { data: participants, error: participantError } = await admin.from('leaderboard_participants')
    .select('id,leaderboard_id').eq('clipper_profile_id', account.clipper_profile_id).eq('status', 'active')
  if (participantError) throw participantError
  if (!participants?.length) return
  const { data: accounts, error: accountsError } = await admin.from('social_accounts')
    .select('id,provider').eq('clipper_profile_id', account.clipper_profile_id)
  if (accountsError) throw accountsError
  if (!accounts?.length) return
  const videos: MetricVideo[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from('videos')
      .select('id,social_account_id,latest_views,latest_likes,latest_comments,latest_shares')
      .in('social_account_id', accounts.map(a => a.id)).eq('is_deleted', false)
      .lt('published_at', new Date().toISOString()).order('id').range(offset, offset + 999)
    if (error) throw error
    videos.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  for (const participant of participants) {
    const { data: board, error: boardError } = await admin.from('leaderboards')
      .select('platforms').eq('id', participant.leaderboard_id).single()
    if (boardError) throw boardError
    const excluded = new Set<string>()
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from('video_exclusions').select('video_id')
        .eq('leaderboard_id', participant.leaderboard_id).order('video_id').range(offset, offset + 999)
      if (error) throw error
      for (const row of data ?? []) excluded.add(row.video_id)
      if (!data || data.length < 1000) break
    }
    const allowed = new Set(accounts.filter(a => board.platforms.includes(a.provider)).map(a => a.id))
    const { error } = await admin.from('leaderboard_entries').upsert({
      leaderboard_id: participant.leaderboard_id, participant_id: participant.id, period_key: HISTORY_PERIOD,
      ...historyMetrics(videos.filter(v => allowed.has(v.social_account_id)), excluded),
      rank: null, previous_rank: null, computed_at: new Date().toISOString(),
    }, { onConflict: 'leaderboard_id,participant_id,period_key' })
    if (error) throw error
  }
}
