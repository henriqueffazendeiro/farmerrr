import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SocialAccount, SyncJobKind, Video } from '@/lib/db/types'
import type { ProviderVideo, SocialProvider } from '@/lib/providers/types'
import { ProviderError } from '@/lib/providers/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProvider, isMockMode } from '@/lib/providers/registry'
import { markNeedsReauth, usableTokens } from '@/lib/sync/tokens'
import { persistThumbnail } from '@/lib/sync/thumbnails'

type Admin = SupabaseClient<Database>

const MAX_DISCOVER_PAGES = 3
const MAX_REFRESH_VIDEOS = 100

export type SyncResult = {
  discovered: number
  refreshed: number
  removed: number
}

// ─── Cadência ────────────────────────────────────────────────────────────

const HOUR = 3_600_000

/** Com que frequência vale a pena voltar a pedir as métricas de um vídeo. */
export function refreshIntervalMs(publishedAt: Date, now = Date.now()): number {
  const ageHours = (now - publishedAt.getTime()) / HOUR
  if (ageHours < 48) return 1 * HOUR
  if (ageHours < 24 * 7) return 6 * HOUR
  return 24 * HOUR
}

function needsRefresh(video: Video, now = Date.now()): boolean {
  if (!video.metrics_updated_at) return true
  const interval = refreshIntervalMs(new Date(video.published_at), now)
  return now - new Date(video.metrics_updated_at).getTime() >= interval
}

// ─── Escrita ─────────────────────────────────────────────────────────────

async function recordMetrics(
  admin: Admin,
  rows: { videoId: string; video: ProviderVideo }[],
): Promise<void> {
  if (rows.length === 0) return

  const { error } = await admin.from('video_metrics').insert(
    rows.map(({ videoId, video }) => ({
      video_id: videoId,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      shares: video.shares,
    })),
  )
  if (error) throw error
}

async function insertNewVideos(
  admin: Admin,
  account: SocialAccount,
  incoming: ProviderVideo[],
): Promise<number> {
  if (incoming.length === 0) return 0

  const rows = await Promise.all(
    incoming.map(async (video) => ({
      social_account_id: account.id,
      provider: account.provider,
      provider_video_id: video.providerVideoId,
      url: video.url,
      embed_link: video.embedLink,
      // A miniatura é copiada agora porque o link do TikTok expira (~6 h).
      thumbnail_url: await persistThumbnail(admin, video.providerVideoId, video.thumbnailUrl),
      caption: video.caption,
      duration_seconds: video.durationSeconds,
      published_at: video.publishedAt.toISOString(),
      latest_views: video.views,
      latest_likes: video.likes,
      latest_comments: video.comments,
      latest_shares: video.shares,
      metrics_updated_at: new Date().toISOString(),
    })),
  )

  const { data, error } = await admin
    .from('videos')
    .upsert(rows, { onConflict: 'provider,provider_video_id' })
    .select('id, provider_video_id')
  if (error) throw error

  const byProviderId = new Map((data ?? []).map((v) => [v.provider_video_id, v.id]))
  await recordMetrics(
    admin,
    incoming
      .filter((v) => byProviderId.has(v.providerVideoId))
      .map((v) => ({ videoId: byProviderId.get(v.providerVideoId)!, video: v })),
  )

  return data?.length ?? 0
}

async function updateMetrics(
  admin: Admin,
  known: Map<string, Video>,
  incoming: ProviderVideo[],
): Promise<number> {
  const now = new Date().toISOString()
  const touched: { videoId: string; video: ProviderVideo }[] = []

  for (const video of incoming) {
    const existing = known.get(video.providerVideoId)
    if (!existing) continue

    const { error } = await admin
      .from('videos')
      .update({
        latest_views: video.views,
        latest_likes: video.likes,
        latest_comments: video.comments,
        latest_shares: video.shares,
        metrics_updated_at: now,
        is_deleted: false,
        caption: video.caption ?? existing.caption,
        url: video.url ?? existing.url,
      })
      .eq('id', existing.id)
    if (error) throw error

    touched.push({ videoId: existing.id, video })
  }

  await recordMetrics(admin, touched)
  return touched.length
}

// ─── Operações ───────────────────────────────────────────────────────────

async function syncProfile(
  admin: Admin,
  provider: SocialProvider,
  account: SocialAccount,
  tokens: Awaited<ReturnType<typeof usableTokens>>,
): Promise<void> {
  const info = await provider.getAccount(tokens)

  await admin
    .from('social_accounts')
    .update({
      username: info.username,
      display_name: info.displayName,
      avatar_url: info.avatarUrl,
      profile_url: info.profileUrl,
      follower_count: info.followerCount,
      following_count: info.followingCount,
      likes_count: info.likesCount,
      video_count: info.videoCount,
      stats_updated_at: new Date().toISOString(),
      provider_union_id: info.unionId,
    })
    .eq('id', account.id)

  // O nome que aparece no leaderboard segue o do TikTok enquanto o clipper
  // não escolher outro.
  if (info.displayName) {
    await admin
      .from('clipper_profiles')
      .update({ display_name: info.displayName, avatar_url: info.avatarUrl })
      .eq('id', account.clipper_profile_id)
  }
}

async function discover(
  admin: Admin,
  provider: SocialProvider,
  account: SocialAccount,
  tokens: Awaited<ReturnType<typeof usableTokens>>,
): Promise<{ discovered: number; refreshed: number }> {
  const collected: ProviderVideo[] = []
  let cursor: string | null = null

  for (let page = 0; page < MAX_DISCOVER_PAGES; page++) {
    const result = await provider.listVideos(tokens, { cursor, max: 20 })
    collected.push(...result.videos)
    cursor = result.cursor
    if (!result.hasMore || !cursor) break
  }

  if (collected.length === 0) return { discovered: 0, refreshed: 0 }

  const ids = collected.map((v) => v.providerVideoId)
  const { data: existing } = await admin
    .from('videos')
    .select('*')
    .eq('social_account_id', account.id)
    .in('provider_video_id', ids)

  const known = new Map((existing ?? []).map((v) => [v.provider_video_id, v]))
  const fresh = collected.filter((v) => !known.has(v.providerVideoId))

  const discovered = await insertNewVideos(admin, account, fresh)
  const refreshed = await updateMetrics(admin, known, collected)

  return { discovered, refreshed }
}

async function refreshMetrics(
  admin: Admin,
  provider: SocialProvider,
  account: SocialAccount,
  tokens: Awaited<ReturnType<typeof usableTokens>>,
): Promise<{ refreshed: number; removed: number }> {
  const { data: videos } = await admin
    .from('videos')
    .select('*')
    .eq('social_account_id', account.id)
    .eq('is_deleted', false)
    .order('published_at', { ascending: false })
    .limit(400)

  const due = (videos ?? []).filter((v) => needsRefresh(v)).slice(0, MAX_REFRESH_VIDEOS)
  if (due.length === 0) return { refreshed: 0, removed: 0 }

  const known = new Map(due.map((v) => [v.provider_video_id, v]))
  let refreshed = 0
  let removed = 0

  for (let i = 0; i < due.length; i += provider.batchSize) {
    const batch = due.slice(i, i + provider.batchSize)
    const returned = await provider.getVideosByIds(
      tokens,
      batch.map((v) => v.provider_video_id),
    )

    refreshed += await updateMetrics(admin, known, returned)

    // O que a API já não devolve deixou de estar público: sai da contagem,
    // mas o histórico fica.
    const returnedIds = new Set(returned.map((v) => v.providerVideoId))
    const missing = batch.filter((v) => !returnedIds.has(v.provider_video_id))
    if (missing.length > 0) {
      await admin
        .from('videos')
        .update({ is_deleted: true })
        .in(
          'id',
          missing.map((v) => v.id),
        )
      removed += missing.length
    }
  }

  return { refreshed, removed }
}

// ─── Ponto de entrada ────────────────────────────────────────────────────

/** Sincroniza uma conta e recalcula os leaderboards que dependem dela. */
async function runAccountSync(
  accountId: string,
  kind: SyncJobKind = 'discover',
): Promise<SyncResult> {
  const admin = createAdminClient()

  const { data: account } = await admin
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle()

  if (!account) throw new Error(`Conta ${accountId} não encontrada.`)
  if (account.status === 'revoked') return { discovered: 0, refreshed: 0, removed: 0 }
  if (account.provider_user_id.startsWith('mock-') !== isMockMode()) throw new Error('A conta pertence a outro modo de integração.')

  const provider = getProvider(account.provider)

  let result: SyncResult = { discovered: 0, refreshed: 0, removed: 0 }

  try {
    const tokens = await usableTokens(admin, provider, account)

    if (kind === 'profile') {
      await syncProfile(admin, provider, account, tokens)
    } else if (kind === 'refresh') {
      const { refreshed, removed } = await refreshMetrics(admin, provider, account, tokens)
      result = { discovered: 0, refreshed, removed }
    } else {
      // 'discover' faz também o perfil: é uma chamada barata e mantém os
      // seguidores atualizados sem um job dedicado.
      await syncProfile(admin, provider, account, tokens)
      const { discovered, refreshed } = await discover(admin, provider, account, tokens)
      result = { discovered, refreshed, removed: 0 }
    }
  } catch (error) {
    if (error instanceof ProviderError && error.kind === 'auth') {
      await markNeedsReauth(admin, accountId)
    }
    throw error
  }

  const { error: syncError } = await admin
    .from('social_accounts')
    .update({ last_synced_at: new Date().toISOString(), ...(kind === 'discover' ? { last_discovered_at: new Date().toISOString() } : {}) })
    .eq('id', accountId)
  if (syncError) throw syncError

  const { error: rankError } = await admin.rpc('recompute_for_account', { p_social_account_id: accountId })
  if (rankError) throw rankError

  return result
}

export async function syncAccount(accountId: string, kind: SyncJobKind = 'discover'): Promise<SyncResult> {
  const db = createAdminClient()
  const lease = new Date(Date.now() + 5 * 60_000).toISOString()
  const { data, error } = await db.from('social_accounts').update({ sync_locked_until: lease })
    .eq('id', accountId).lt('sync_locked_until', new Date().toISOString()).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new ProviderError('Esta conta já está a ser sincronizada.', 'rate_limit')
  try { return await runAccountSync(accountId, kind) }
  finally {
    await db.from('social_accounts').update({ sync_locked_until: new Date(0).toISOString() }).eq('id', accountId).eq('sync_locked_until', lease)
  }
}
