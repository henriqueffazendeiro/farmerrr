import 'server-only'

import { serverEnv, publicEnv } from '@/lib/config/env'
import {
  ProviderError,
  type ProviderAccount,
  type ProviderTokens,
  type ProviderVideo,
  type SocialProvider,
  type VideoPage,
} from '@/lib/providers/types'

/**
 * TikTok — Login Kit + Display API (endpoints oficiais).
 *
 * Scopes:
 *   user.info.basic    open_id, display_name, avatar
 *   user.info.profile  username, profile_deep_link
 *   user.info.stats    follower_count, likes_count, video_count
 *   video.list         lista de vídeos públicos e respetivas métricas
 *
 * Referência: https://developers.tiktok.com/doc/tiktok-api-v2-video-list/
 */

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/'
const API = 'https://open.tiktokapis.com/v2'

export const TIKTOK_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
] as const

const USER_FIELDS = [
  'open_id',
  'union_id',
  'avatar_url_100',
  'display_name',
  'username',
  'profile_deep_link',
  'follower_count',
  'following_count',
  'likes_count',
  'video_count',
].join(',')

const VIDEO_FIELDS = [
  'id',
  'create_time',
  'cover_image_url',
  'share_url',
  'embed_link',
  'video_description',
  'title',
  'duration',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
].join(',')

type RawVideo = {
  id: string
  create_time?: number
  cover_image_url?: string
  share_url?: string
  embed_link?: string
  video_description?: string
  title?: string
  duration?: number
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
}

function mapVideo(raw: RawVideo): ProviderVideo {
  if (!raw.id || !Number.isFinite(raw.create_time) || (raw.create_time ?? 0) <= 0) {
    throw new ProviderError('Vídeo inválido na resposta do TikTok.', 'unknown')
  }
  return {
    providerVideoId: String(raw.id),
    url: raw.share_url ?? null,
    embedLink: raw.embed_link ?? null,
    thumbnailUrl: raw.cover_image_url ?? null,
    caption: raw.video_description || raw.title || null,
    durationSeconds: raw.duration ?? null,
    // create_time vem em segundos Unix.
    publishedAt: new Date((raw.create_time ?? 0) * 1000),
    views: raw.view_count ?? 0,
    likes: raw.like_count ?? 0,
    comments: raw.comment_count ?? 0,
    shares: raw.share_count ?? 0,
  }
}

function fail(status: number, body: string): never {
  if (status === 401 || status === 403) {
    throw new ProviderError('Autorização do TikTok inválida ou expirada.', 'auth', status)
  }
  if (status === 429) {
    throw new ProviderError('Limite de pedidos do TikTok atingido.', 'rate_limit', status)
  }
  throw new ProviderError(`TikTok respondeu ${status}: ${body.slice(0, 200)}`, 'unknown', status)
}

async function tokenRequest(body: Record<string, string>): Promise<ProviderTokens> {
  const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET } = serverEnv()

  const response = await fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY ?? '',
      client_secret: TIKTOK_CLIENT_SECRET ?? '',
      ...body,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  const text = await response.text()
  if (!response.ok) fail(response.status, text)

  const json = JSON.parse(text) as {
    access_token?: string
    expires_in?: number
    open_id?: string
    refresh_token?: string
    refresh_expires_in?: number
    scope?: string
    error?: string
    error_description?: string
  }

  if (json.error || !json.access_token) {
    throw new ProviderError(
      json.error_description ?? json.error ?? 'Resposta inesperada do TikTok.',
      'auth',
    )
  }

  const now = Date.now()
  return {
    providerUserId: json.open_id ?? '',
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    accessExpiresAt: json.expires_in ? new Date(now + json.expires_in * 1000) : null,
    refreshExpiresAt: json.refresh_expires_in
      ? new Date(now + json.refresh_expires_in * 1000)
      : null,
    scopes: json.scope ? json.scope.split(/[,\s]+/).filter(Boolean) : [],
  }
}

async function apiRequest<T>(
  tokens: ProviderTokens,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  const text = await response.text()
  if (!response.ok) fail(response.status, text)

  const json = JSON.parse(text) as { data?: T; error?: { code?: string; message?: string } }

  // O TikTok devolve 200 com error.code = 'ok' quando corre bem.
  if (json.error && json.error.code && json.error.code !== 'ok') {
    const code = json.error.code
    const kind =
      code.includes('token') || code.includes('scope')
        ? 'auth'
        : code.includes('rate')
          ? 'rate_limit'
          : 'unknown'
    throw new ProviderError(json.error.message ?? code, kind as 'auth' | 'rate_limit' | 'unknown')
  }

  if (!json.data) throw new ProviderError('Resposta incompleta do TikTok.', 'unknown')
  return json.data as T
}

function redirectUri(): string {
  const { TIKTOK_REDIRECT_URI } = serverEnv()
  return (
    TIKTOK_REDIRECT_URI ??
    `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/auth/tiktok/callback`
  )
}

export const tiktokProvider: SocialProvider = {
  id: 'tiktok',
  label: 'TikTok',
  batchSize: 20,

  isConfigured() {
    const env = serverEnv()
    return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET)
  },

  getAuthUrl(state) {
    const { TIKTOK_CLIENT_KEY } = serverEnv()
    const params = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY ?? '',
      scope: TIKTOK_SCOPES.join(','),
      response_type: 'code',
      redirect_uri: redirectUri(),
      state,
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  },

  exchangeCode(code) {
    return tokenRequest({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(),
    })
  },

  refreshTokens(refreshToken) {
    return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
  },

  async getAccount(tokens) {
    const data = await apiRequest<{ user: Record<string, unknown> }>(
      tokens,
      `/user/info/?fields=${USER_FIELDS}`,
      { method: 'GET' },
    )

    const user = (data?.user ?? {}) as Record<string, string | number | undefined>
    if (!user.open_id || user.open_id !== tokens.providerUserId) throw new ProviderError('Identidade TikTok inválida.', 'auth')
    const username = (user.username as string) ?? null

    return {
      providerUserId: (user.open_id as string) ?? tokens.providerUserId,
      unionId: (user.union_id as string) ?? null,
      username,
      displayName: (user.display_name as string) ?? null,
      avatarUrl: (user.avatar_url_100 as string) ?? null,
      profileUrl:
        (user.profile_deep_link as string) ??
        (username ? `https://www.tiktok.com/@${username}` : null),
      followerCount: (user.follower_count as number) ?? null,
      followingCount: (user.following_count as number) ?? null,
      likesCount: (user.likes_count as number) ?? null,
      videoCount: (user.video_count as number) ?? null,
    } satisfies ProviderAccount
  },

  async listVideos(tokens, options = {}) {
    const body: Record<string, unknown> = { max_count: Math.min(options.max ?? 20, 20) }
    // O cursor do TikTok é um timestamp Unix em milissegundos.
    if (options.cursor) body.cursor = Number(options.cursor)

    const data = await apiRequest<{
      videos?: RawVideo[]
      cursor?: number
      has_more?: boolean
    }>(tokens, `/video/list/?fields=${VIDEO_FIELDS}`, { method: 'POST', body })

    if (!Array.isArray(data?.videos) || typeof data.has_more !== 'boolean') throw new ProviderError('Lista de vídeos incompleta.', 'unknown')

    return {
      videos: (data?.videos ?? []).map(mapVideo),
      cursor: data?.cursor != null ? String(data.cursor) : null,
      hasMore: Boolean(data?.has_more),
    } satisfies VideoPage
  },

  async getVideosByIds(tokens, ids) {
    if (ids.length === 0) return []

    const data = await apiRequest<{ videos?: RawVideo[] }>(
      tokens,
      `/video/query/?fields=${VIDEO_FIELDS}`,
      { method: 'POST', body: { filters: { video_ids: ids.slice(0, 20) } } },
    )

    if (!Array.isArray(data?.videos)) throw new ProviderError('Métricas de vídeos incompletas.', 'unknown')
    return data.videos.map(mapVideo)
  },
}
