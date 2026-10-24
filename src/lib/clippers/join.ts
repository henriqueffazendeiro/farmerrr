import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { encryptOptional, encryptToken } from '@/lib/crypto/tokens'
import type { ProviderAccount, ProviderTokens } from '@/lib/providers/types'
import type { SocialProviderId } from '@/lib/db/types'

export type JoinResult = {
  participantId: string
  socialAccountId: string
  alreadyMember: boolean
}

/**
 * Liga uma conta social a um leaderboard.
 *
 * A identidade do clipper é o id da conta na plataforma. Se essa conta já
 * existir de outra competição, reaproveitamos a pessoa e os vídeos — entrar
 * num segundo leaderboard passa a ser um clique.
 */
export async function connectAccountToLeaderboard(options: {
  leaderboardId: string
  provider: SocialProviderId
  tokens: ProviderTokens
  account: ProviderAccount
}): Promise<JoinResult> {
  const { leaderboardId, provider, tokens, account } = options
  const admin = createAdminClient()

  const { data: board, error: boardError } = await admin.from('leaderboards')
    .select('status,ends_at,platforms').eq('id', leaderboardId).maybeSingle()
  if (boardError) throw boardError
  if (!board || board.status !== 'active' || (board.ends_at && new Date(board.ends_at).getTime() <= Date.now()) || !board.platforms.includes(provider)) {
    throw new Error('Esta competição não aceita inscrições.')
  }
  if (!account.providerUserId || account.providerUserId !== tokens.providerUserId) throw new Error('Identidade TikTok inválida.')
  if (!tokens.scopes.includes('video.list')) throw new Error('Autoriza a leitura de vídeos para participar.')

  const displayName = account.displayName || account.username || 'Clipper'

  // 1. A conta já é conhecida?
  const { data: existing, error: existingError } = await admin
    .from('social_accounts')
    .select('*')
    .eq('provider', provider)
    .eq('provider_user_id', account.providerUserId)
    .maybeSingle()

  if (existingError) throw existingError

  let clipperProfileId: string
  let socialAccountId: string

  const accountFields = {
    provider_union_id: account.unionId,
    username: account.username,
    display_name: account.displayName,
    avatar_url: account.avatarUrl,
    profile_url: account.profileUrl,
    follower_count: account.followerCount,
    following_count: account.followingCount,
    likes_count: account.likesCount,
    video_count: account.videoCount,
    stats_updated_at: new Date().toISOString(),
    access_token_enc: encryptToken(tokens.accessToken),
    refresh_token_enc: encryptOptional(tokens.refreshToken),
    access_expires_at: tokens.accessExpiresAt?.toISOString() ?? null,
    refresh_expires_at: tokens.refreshExpiresAt?.toISOString() ?? null,
    scopes: tokens.scopes,
    status: 'connected' as const,
  }

  if (existing) {
    clipperProfileId = existing.clipper_profile_id
    socialAccountId = existing.id
    const { error: accountUpdateError } = await admin.from('social_accounts').update(accountFields).eq('id', existing.id)
    if (accountUpdateError) throw accountUpdateError
    const { error: profileUpdateError } = await admin
      .from('clipper_profiles')
      .update({ display_name: displayName, avatar_url: account.avatarUrl })
      .eq('id', clipperProfileId)
    if (profileUpdateError) throw profileUpdateError
  } else {
    const { data: profile, error: profileError } = await admin
      .from('clipper_profiles')
      .insert({ display_name: displayName, avatar_url: account.avatarUrl })
      .select('id')
      .single()

    if (profileError || !profile) {
      throw new Error('Não foi possível criar o perfil do clipper.')
    }

    clipperProfileId = profile.id

    const { data: created, error: accountError } = await admin
      .from('social_accounts')
      .insert({
        clipper_profile_id: clipperProfileId,
        provider,
        provider_user_id: account.providerUserId,
        ...accountFields,
      })
      .select('id')
      .single()

    if (accountError || !created) {
      throw new Error('Não foi possível guardar a ligação ao TikTok.')
    }

    socialAccountId = created.id
  }

  // 2. Participação nesta competição.
  const { data: participation, error: participationError } = await admin
    .from('leaderboard_participants')
    .select('id, status')
    .eq('leaderboard_id', leaderboardId)
    .eq('clipper_profile_id', clipperProfileId)
    .maybeSingle()

  let participantId: string
  if (participationError) throw participationError
  if (participation?.status === 'disqualified') throw new Error('A participação nesta competição foi desqualificada.')
  const alreadyMember = Boolean(participation)

  if (participation) {
    participantId = participation.id
    if (participation.status === 'left') {
      const { error } = await admin
        .from('leaderboard_participants')
        .update({ status: 'active' })
        .eq('id', participation.id)
      if (error) throw error
    }
  } else {
    const { data: joined, error: joinError } = await admin
      .from('leaderboard_participants')
      .insert({ leaderboard_id: leaderboardId, clipper_profile_id: clipperProfileId })
      .select('id')
      .single()

    if (joinError || !joined) {
      throw new Error('Não foi possível entrar no leaderboard.')
    }
    participantId = joined.id
  }

  // 3. Importar os clips já a seguir, com prioridade alta.
  const { error: queueError } = await admin.rpc('enqueue_sync_job', {
    p_social_account_id: socialAccountId,
    p_kind: 'discover',
    p_priority: 1,
  })
  if (queueError) throw queueError

  const { error: rankingError } = await admin.rpc('recompute_for_account', { p_social_account_id: socialAccountId })
  if (rankingError) throw rankingError

  return { participantId, socialAccountId, alreadyMember }
}
