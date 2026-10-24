import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { periodBounds } from '@/lib/period'
import type {
  ClipperProfile,
  Leaderboard,
  LeaderboardEntry,
  LeaderboardParticipant,
  SocialAccountPublic,
  Video,
} from '@/lib/db/types'

export type ClipperRow = {
  participantId: string
  clipperProfileId: string
  displayName: string
  avatarUrl: string | null
  username: string | null
  profileUrl: string | null
  followerCount: number | null
  status: LeaderboardParticipant['status']
  joinedAt: string
  needsReauth: boolean
  totalViews: number
  totalLikes: number
  videoCount: number
  avgViews: number
  rank: number | null
  previousRank: number | null
  bestVideoId: string | null
}

export type VideoRow = Video & {
  participantId: string | null
  clipperName: string
  username: string | null
  excluded: boolean
}

/** Leaderboard público pelo endereço. Devolve null se for privado ou rascunho. */
export async function getLeaderboardBySlug(slug: string): Promise<Leaderboard | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leaderboards')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  return data ?? null
}

export async function getCreatorOf(leaderboard: Leaderboard) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('creators')
    .select('*')
    .eq('id', leaderboard.creator_id)
    .maybeSingle()
  return data ?? null
}

/**
 * Todas as linhas do ranking de um período, já ordenadas.
 * Faz 4 queries simples em vez de um join encadeado — mais previsível e
 * suficientemente rápido para as dimensões deste produto.
 */
export async function getClippers(
  leaderboardId: string,
  periodKey: string,
): Promise<ClipperRow[]> {
  const supabase = await createClient()

  const { data: participants } = await supabase
    .from('leaderboard_participants')
    .select('*')
    .eq('leaderboard_id', leaderboardId)

  if (!participants || participants.length === 0) return []

  const profileIds = [...new Set(participants.map((p) => p.clipper_profile_id))]

  const [{ data: profiles }, { data: accounts }, { data: entries }] = await Promise.all([
    supabase.from('clipper_profiles').select('*').in('id', profileIds),
    supabase.from('social_accounts_public').select('*').in('clipper_profile_id', profileIds),
    supabase
      .from('leaderboard_entries')
      .select('*')
      .eq('leaderboard_id', leaderboardId)
      .eq('period_key', periodKey),
  ])

  const profileById = new Map<string, ClipperProfile>((profiles ?? []).map((p) => [p.id, p]))
  const entryByParticipant = new Map<string, LeaderboardEntry>(
    (entries ?? []).map((e) => [e.participant_id, e]),
  )
  const accountsByProfile = new Map<string, SocialAccountPublic[]>()
  for (const account of accounts ?? []) {
    const list = accountsByProfile.get(account.clipper_profile_id) ?? []
    list.push(account)
    accountsByProfile.set(account.clipper_profile_id, list)
  }

  const rows: ClipperRow[] = participants.map((participant) => {
    const profile = profileById.get(participant.clipper_profile_id)
    const linked = accountsByProfile.get(participant.clipper_profile_id) ?? []
    const primary = linked[0] ?? null
    const entry = entryByParticipant.get(participant.id)

    return {
      participantId: participant.id,
      clipperProfileId: participant.clipper_profile_id,
      displayName: profile?.display_name ?? primary?.display_name ?? 'Clipper',
      avatarUrl: profile?.avatar_url ?? primary?.avatar_url ?? null,
      username: primary?.username ?? null,
      profileUrl: primary?.profile_url ?? null,
      followerCount: linked.reduce<number | null>(
        (sum, a) => (a.follower_count == null ? sum : (sum ?? 0) + a.follower_count),
        null,
      ),
      status: participant.status,
      joinedAt: participant.joined_at,
      needsReauth: linked.some((a) => a.status === 'needs_reauth'),
      totalViews: entry?.total_views ?? 0,
      totalLikes: entry?.total_likes ?? 0,
      videoCount: entry?.video_count ?? 0,
      avgViews: entry?.avg_views ?? 0,
      rank: entry?.rank ?? null,
      previousRank: entry?.previous_rank ?? null,
      bestVideoId: entry?.best_video_id ?? null,
    }
  })

  return rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    if (a.rank != null && b.rank != null) return a.rank - b.rank
    if (a.rank != null) return -1
    if (b.rank != null) return 1
    return b.totalViews - a.totalViews
  })
}

type VideoQuery = {
  periodKey: string
  limit?: number
  participantId?: string
  includeExcluded?: boolean
  orderBy?: 'views' | 'date'
}

/** Vídeos que contam (ou contariam) para o leaderboard, no período dado. */
export async function getVideos(
  leaderboard: Leaderboard,
  { periodKey, limit = 24, participantId, includeExcluded = false, orderBy = 'views' }: VideoQuery,
): Promise<VideoRow[]> {
  const supabase = await createClient()
  const { from, to } = periodBounds(leaderboard, periodKey)

  let participantQuery = supabase
    .from('leaderboard_participants')
    .select('*')
    .eq('leaderboard_id', leaderboard.id)
    .eq('status', 'active')

  if (participantId) participantQuery = participantQuery.eq('id', participantId)

  const { data: participants } = await participantQuery
  if (!participants || participants.length === 0) return []

  const profileIds = [...new Set(participants.map((p) => p.clipper_profile_id))]

  const [{ data: accounts }, { data: profiles }] = await Promise.all([
    supabase.from('social_accounts_public').select('*').in('clipper_profile_id', profileIds),
    supabase.from('clipper_profiles').select('*').in('id', profileIds),
  ])

  const usable = (accounts ?? []).filter((a) =>
    leaderboard.platforms.includes(a.provider),
  )
  if (usable.length === 0) return []

  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .in(
      'social_account_id',
      usable.map((a) => a.id),
    )
    .eq('is_deleted', false)
    .gte('published_at', from.toISOString())
    .lt('published_at', to.toISOString())
    .order(orderBy === 'views' ? 'latest_views' : 'published_at', { ascending: false })
    .limit(limit + 50) // margem para os excluídos que vamos filtrar

  if (!videos || videos.length === 0) return []

  const { data: exclusions } = await supabase
    .from('video_exclusions')
    .select('video_id')
    .eq('leaderboard_id', leaderboard.id)

  const excludedIds = new Set((exclusions ?? []).map((x) => x.video_id))

  const participantByProfile = new Map(participants.map((p) => [p.clipper_profile_id, p.id]))
  const profileNameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]))
  const accountById = new Map(usable.map((a) => [a.id, a]))

  const rows: VideoRow[] = videos.map((video) => {
    const account = accountById.get(video.social_account_id)
    const profileId = account?.clipper_profile_id ?? null
    return {
      ...video,
      participantId: profileId ? (participantByProfile.get(profileId) ?? null) : null,
      clipperName:
        (profileId ? profileNameById.get(profileId) : null) ??
        account?.display_name ??
        'Clipper',
      username: account?.username ?? null,
      excluded: excludedIds.has(video.id),
    }
  })

  return (includeExcluded ? rows : rows.filter((r) => !r.excluded)).slice(0, limit)
}
