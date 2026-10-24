import type { SocialProviderId } from '@/lib/db/types'

export type ProviderTokens = {
  providerUserId: string
  accessToken: string
  refreshToken: string | null
  accessExpiresAt: Date | null
  refreshExpiresAt: Date | null
  scopes: string[]
}

export type ProviderAccount = {
  providerUserId: string
  unionId: string | null
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  profileUrl: string | null
  followerCount: number | null
  followingCount: number | null
  likesCount: number | null
  videoCount: number | null
}

export type ProviderVideo = {
  providerVideoId: string
  url: string | null
  embedLink: string | null
  thumbnailUrl: string | null
  caption: string | null
  durationSeconds: number | null
  publishedAt: Date
  views: number
  likes: number
  comments: number
  shares: number
}

export type VideoPage = {
  videos: ProviderVideo[]
  cursor: string | null
  hasMore: boolean
}

/**
 * Contrato único para todas as plataformas.
 *
 * Todo o resto do sistema — ranking, páginas, sincronização — fala só com
 * esta interface. Adicionar o Instagram Reels ou os YouTube Shorts é escrever
 * uma implementação nova, não mexer no resto.
 */
export interface SocialProvider {
  readonly id: SocialProviderId
  readonly label: string

  /** Há credenciais suficientes para falar com a plataforma? */
  isConfigured(): boolean

  /** URL para onde enviar o clipper. */
  getAuthUrl(state: string): string

  /** Troca o `code` do callback por tokens. */
  exchangeCode(code: string): Promise<ProviderTokens>

  /** Renova o acesso. Devolve sempre o refresh token a usar a seguir. */
  refreshTokens(refreshToken: string): Promise<ProviderTokens>

  /** Perfil público da conta ligada. */
  getAccount(tokens: ProviderTokens): Promise<ProviderAccount>

  /** Página de vídeos, do mais recente para o mais antigo. */
  listVideos(
    tokens: ProviderTokens,
    options?: { cursor?: string | null; max?: number },
  ): Promise<VideoPage>

  /** Métricas atualizadas de vídeos que já conhecemos. */
  getVideosByIds(tokens: ProviderTokens, ids: string[]): Promise<ProviderVideo[]>

  /** Quantos ids cabem num pedido de `getVideosByIds`. */
  readonly batchSize: number
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate_limit' | 'network' | 'unknown' = 'unknown',
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
