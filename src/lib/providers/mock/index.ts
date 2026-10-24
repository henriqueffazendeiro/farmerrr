import 'server-only'

import {
  type ProviderAccount,
  type ProviderTokens,
  type ProviderVideo,
  type SocialProvider,
  type VideoPage,
} from '@/lib/providers/types'

/**
 * Provider falso, para desenvolver e demonstrar o produto inteiro enquanto a
 * app do TikTok não está aprovada (a app review demora, e o sandbox só
 * permite 10 contas de teste).
 *
 * Gera contas e vídeos deterministicamente a partir do id da conta — os
 * mesmos dados em cada chamada — mas com as views a crescer com o tempo real,
 * para o ranking mexer e as animações se verem.
 *
 * Ativar com SOCIAL_PROVIDER=mock.
 */

// ─── PRNG determinístico ─────────────────────────────────────────────────

function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = [
  'João', 'Miguel', 'Pedro', 'Diogo', 'André', 'Rita', 'Beatriz', 'Tomás',
  'Francisco', 'Matilde', 'Gonçalo', 'Inês', 'Rodrigo', 'Carolina', 'Duarte',
]

const CAPTIONS = [
  'Este gajo não é real 😭',
  'Reza a lenda que ainda está a rir',
  'W ou L? 🤔',
  'O momento mais caótico da stream',
  'Não aguentei 💀',
  'Isto tinha de ficar gravado',
  'A reação vale ouro',
  'Quem me dera ter visto ao vivo',
  'O chat explodiu',
  'Melhor clip da semana, mudem-me de ideias',
]

const TAGS = '#clips #fyp #viral #twitchportugal'

// ─── Geradores ───────────────────────────────────────────────────────────

function accountFor(providerUserId: string): ProviderAccount {
  const random = rng(hashSeed(providerUserId))
  const name = NAMES[Math.floor(random() * NAMES.length)]
  const suffix = Math.floor(random() * 900 + 100)
  const username = `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}clips${suffix}`

  return {
    providerUserId,
    unionId: null,
    username,
    displayName: `${name} Clips`,
    avatarUrl: null, // sem imagens externas — o Avatar mostra as iniciais
    profileUrl: `https://www.tiktok.com/@${username}`,
    followerCount: Math.floor(random() * 4000) + 20,
    followingCount: Math.floor(random() * 500),
    likesCount: Math.floor(random() * 300_000),
    videoCount: Math.floor(random() * 40) + 6,
  }
}

/** Início do mês (UTC) deslocado `back` meses. */
function monthStartUtc(back: number): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)
}

type Seedling = {
  providerVideoId: string
  publishedAt: Date
  baseViews: number
  viewsPerMinute: number
  captionIndex: number
  likeRatio: number
}

/**
 * Sementes estáveis: as datas são ancoradas ao início do mês, por isso não
 * mudam de dia para dia e um vídeo não salta para fora da janela do período.
 */
function seedlings(providerUserId: string): Seedling[] {
  const random = rng(hashSeed(providerUserId))
  const count = Math.floor(random() * 18) + 8

  const out: Seedling[] = []
  for (let i = 0; i < count; i++) {
    // ~70% no mês corrente, o resto no anterior (alimenta o histórico geral)
    const monthsBack = random() < 0.7 ? 0 : 1
    const anchor = monthStartUtc(monthsBack)
    const dayInMonth = Math.floor(random() * 27)
    const hour = Math.floor(random() * 20) + 2
    const publishedAt = new Date(anchor + dayInMonth * 86_400_000 + hour * 3_600_000)

    if (publishedAt.getTime() > Date.now()) continue

    // Uma minoria de clips rebenta; a maioria não. É como funciona de verdade.
    const viral = random() < 0.15
    const baseViews = viral
      ? Math.floor(random() * 900_000) + 100_000
      : Math.floor(random() * 40_000) + 300

    out.push({
      providerVideoId: `mock_${providerUserId}_${i}`,
      publishedAt,
      baseViews,
      viewsPerMinute: (viral ? 6 : 0.4) * (0.5 + random()),
      captionIndex: Math.floor(random() * CAPTIONS.length),
      likeRatio: 0.02 + random() * 0.06,
    })
  }

  return out.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

function materialize(seed: Seedling): ProviderVideo {
  const minutesLive = Math.max(0, (Date.now() - seed.publishedAt.getTime()) / 60_000)
  // Crescimento que abranda com a idade — parecido com a curva real de um clip.
  const growth = Math.floor(seed.viewsPerMinute * Math.min(minutesLive, 60 * 24 * 10))
  const views = seed.baseViews + growth
  const likes = Math.floor(views * seed.likeRatio)

  return {
    providerVideoId: seed.providerVideoId,
    url: `https://www.tiktok.com/@farmerrr/video/${seed.providerVideoId}`,
    embedLink: null,
    thumbnailUrl: null,
    caption: `${CAPTIONS[seed.captionIndex]} ${TAGS}`,
    durationSeconds: 15 + (seed.captionIndex % 5) * 8,
    publishedAt: seed.publishedAt,
    views,
    likes,
    comments: Math.floor(likes * 0.06),
    shares: Math.floor(likes * 0.12),
  }
}

// ─── Provider ────────────────────────────────────────────────────────────

export const mockProvider: SocialProvider = {
  id: 'tiktok',
  label: 'TikTok (simulado)',
  batchSize: 20,

  isConfigured() {
    return true
  },

  getAuthUrl(state) {
    // Salta a plataforma: volta já ao callback com um código falso.
    const code = `mock_${Math.random().toString(36).slice(2, 10)}`
    return `/api/auth/tiktok/callback?code=${code}&state=${encodeURIComponent(state)}&mock=1`
  },

  async exchangeCode(code) {
    const providerUserId = `mock-${hashSeed(code).toString(36)}`
    return {
      providerUserId,
      accessToken: `mock-access-${providerUserId}`,
      refreshToken: `mock-refresh-${providerUserId}`,
      accessExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      refreshExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      scopes: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'],
    } satisfies ProviderTokens
  },

  async refreshTokens(refreshToken) {
    const providerUserId = refreshToken.replace('mock-refresh-', '')
    return {
      providerUserId,
      accessToken: `mock-access-${providerUserId}`,
      refreshToken,
      accessExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      refreshExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      scopes: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'],
    } satisfies ProviderTokens
  },

  async getAccount(tokens) {
    return accountFor(tokens.providerUserId)
  },

  async listVideos(tokens, options = {}) {
    const all = seedlings(tokens.providerUserId)
    const max = Math.min(options.max ?? 20, 20)
    const start = options.cursor ? Number(options.cursor) : 0
    const slice = all.slice(start, start + max)

    return {
      videos: slice.map(materialize),
      cursor: start + max < all.length ? String(start + max) : null,
      hasMore: start + max < all.length,
    } satisfies VideoPage
  },

  async getVideosByIds(tokens, ids) {
    const wanted = new Set(ids)
    return seedlings(tokens.providerUserId)
      .filter((s) => wanted.has(s.providerVideoId))
      .map(materialize)
  },
}
