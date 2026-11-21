import 'server-only'
import { z } from 'zod'
import type { DetectedLive, StreamPlatform } from './model'
import { normalizeStreamChannel } from './public-input'
import { readYouTubeLiveBatch, readYouTubePublic, youtubePublicConfigured } from './youtube-public'

/**
 * Canais públicos lidos pelas APIs oficiais (Twitch Helix, Kick Public API, YouTube Data API),
 * com as credenciais da app farmerrr. O streamer não autoriza nada e não corre nada no PC.
 */
export const PUBLIC_STREAM_MARKER = 'api:public'
/** Valores antigos da mesma coluna (scraper/programa no PC, já removidos): passam a ser lidos pela API. */
export const LEGACY_PUBLIC_MARKERS = ['apify:public', 'agent:public']
export const isPublicMarker = (value: string) => value === PUBLIC_STREAM_MARKER || LEGACY_PUBLIC_MARKERS.includes(value)

export type PastLive = DetectedLive & { ended_at: string | null }
export type PublicChannelSnapshot = { channel_id: string; channel_name: string; channel_url: string; streams: DetectedLive[]; past?: PastLive[] }

const credentials = (platform: 'twitch' | 'kick') => ({
  clientId: process.env[`${platform.toUpperCase()}_CLIENT_ID`]?.trim() || '',
  clientSecret: process.env[`${platform.toUpperCase()}_CLIENT_SECRET`]?.trim() || '',
})

export function publicStreamsConfigured(platform: StreamPlatform) {
  if (platform === 'youtube') return youtubePublicConfigured()
  const { clientId, clientSecret } = credentials(platform)
  return Boolean(clientId && clientSecret)
}

// ─── Token da app (client credentials), guardado em memória até perto de expirar ───
const appTokens = new Map<string, { token: string; expiresAt: number }>()
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() })

async function appToken(platform: 'twitch' | 'kick', renew = false) {
  const cached = appTokens.get(platform)
  if (!renew && cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const { clientId, clientSecret } = credentials(platform)
  if (!clientId || !clientSecret) throw new Error(`Não foi possível consultar o canal: a API da ${platform === 'twitch' ? 'Twitch' : 'Kick'} não está configurada.`)
  const url = platform === 'twitch' ? 'https://id.twitch.tv/oauth2/token' : 'https://id.kick.com/oauth/token'
  const response = await fetch(url, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12_000),
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }) })
    .catch(() => { throw new Error('Não foi possível consultar o canal. Tenta novamente.') })
  if (!response.ok) throw new Error('Não foi possível consultar o canal: as credenciais da API foram recusadas.')
  const body = tokenSchema.parse(await response.json())
  appTokens.set(platform, { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 })
  return body.access_token
}

export async function api(platform: 'twitch' | 'kick', url: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  for (const renew of [false, true]) {
    const token = await appToken(platform, renew)
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000), method: init.method ?? 'GET',
      body: init.body === undefined ? undefined : JSON.stringify(init.body), headers: {
      Authorization: `Bearer ${token}`, ...(platform === 'twitch' ? { 'Client-Id': credentials('twitch').clientId } : {}),
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    } }).catch(() => { throw new Error('Não foi possível consultar o canal. Tenta novamente.') })
    if (response.status === 401 && !renew) continue
    if (!response.ok) throw new ApiError(response.status, `Não foi possível consultar o canal (HTTP ${response.status}). Tenta novamente.`)
    return response.status === 204 ? null : response.json()
  }
  throw new Error('Não foi possível consultar o canal. Tenta novamente.')
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

const date = z.string().datetime({ offset: true })
/** Mesmo formato de hora em todo o lado (sem milissegundos), para o ID das lives da Kick bater certo. */
export const isoSecond = (value: string) => new Date(value).toISOString().replace('.000Z', 'Z')
export const kickLiveId = (broadcasterId: string, startedAt: string) => `${broadcasterId}:${isoSecond(startedAt)}`
export const twitchThumbnail = (login: string) => `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login.toLowerCase()}-640x360.jpg`

// ─── Twitch (Helix) ───
const twitchUsers = z.object({ data: z.array(z.object({ id: z.string(), login: z.string(), display_name: z.string() })) })
const twitchStreams = z.object({ data: z.array(z.object({ id: z.string(), user_id: z.string(), title: z.string(), started_at: date, thumbnail_url: z.string() })) })
const twitchVideos = z.object({ data: z.array(z.object({ id: z.string(), stream_id: z.string().nullish(), title: z.string(), created_at: date,
  duration: z.string(), thumbnail_url: z.string(), url: z.string().url() })) })

/** "3h2m10s" → milissegundos. */
const durationMs = (value: string) => {
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  return match ? ((Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * 60 + Number(match[3] ?? 0)) * 1000 : 0
}

async function readTwitch(url: string, history: boolean): Promise<PublicChannelSnapshot> {
  const login = new URL(url).pathname.slice(1)
  const user = twitchUsers.parse(await api('twitch', `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`)).data[0]
  if (!user) throw new Error('Não foi possível consultar o canal: não existe nenhum canal Twitch com esse nome.')
  const channelUrl = `https://www.twitch.tv/${user.login}`
  const live = twitchStreams.parse(await api('twitch', `https://api.twitch.tv/helix/streams?user_id=${user.id}`)).data
    .filter(stream => stream.user_id === user.id)
  const streams = live.map(stream => ({ external_id: stream.id, title: stream.title, started_at: stream.started_at,
    thumbnail_url: stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360'), watch_url: channelUrl }))
  // Lives passadas: as VODs gravadas (type=archive). A VOD da live em curso fica de fora.
  const past: PastLive[] = !history ? [] : twitchVideos.parse(await api('twitch', `https://api.twitch.tv/helix/videos?user_id=${user.id}&type=archive&first=50`)).data
    .filter(video => !live.some(stream => stream.id === video.stream_id))
    .map(video => ({ external_id: video.stream_id || `vod:${video.id}`, title: video.title, started_at: video.created_at,
      ended_at: new Date(new Date(video.created_at).getTime() + durationMs(video.duration)).toISOString(),
      thumbnail_url: video.thumbnail_url.includes('%{width}') ? video.thumbnail_url.replace('%{width}', '640').replace('%{height}', '360') : null,
      watch_url: video.url }))
  return { channel_id: user.id, channel_name: user.display_name, channel_url: channelUrl, streams, past }
}

// ─── Kick (Public API v1) ───
const kickChannels = z.object({ data: z.array(z.object({ broadcaster_user_id: z.number(), slug: z.string(), stream_title: z.string(),
  stream: z.object({ is_live: z.boolean(), start_time: z.string().optional(), thumbnail: z.string().optional() }) })) })

async function readKick(url: string): Promise<PublicChannelSnapshot> {
  const slug = new URL(url).pathname.slice(1)
  const channel = kickChannels.parse(await api('kick', `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`)).data
    .find(item => item.slug.toLowerCase() === slug)
  if (!channel) throw new Error('Não foi possível consultar o canal: não existe nenhum canal Kick com esse nome.')
  const id = String(channel.broadcaster_user_id)
  const channelUrl = `https://kick.com/${channel.slug}`
  if (!channel.stream.is_live) return { channel_id: id, channel_name: channel.slug, channel_url: channelUrl, streams: [] }
  const started = date.safeParse(channel.stream.start_time)
  if (!started.success) throw new Error('A plataforma devolveu uma live incompleta. Tenta novamente.')
  // A API pública da Kick não tem histórico de lives: cada live fica registada enquanto está em direto.
  return { channel_id: id, channel_name: channel.slug, channel_url: channelUrl, streams: [{
    external_id: kickLiveId(id, started.data), title: channel.stream_title || 'Live na Kick', started_at: started.data,
    thumbnail_url: channel.stream.thumbnail || null, watch_url: channelUrl,
  }] }
}

export async function readPublicChannel(platform: StreamPlatform, input: string, { history = false } = {}): Promise<PublicChannelSnapshot> {
  const url = normalizeStreamChannel(platform, input)
  if (platform === 'twitch') return readTwitch(url, history)
  if (platform === 'kick') return readKick(url)
  if (!youtubePublicConfigured()) throw new Error('Não foi possível consultar o YouTube: falta configurar a chave da API.')
  return readYouTubePublic(url, history)
}

const chunks = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))
const kickLivestreams = z.object({ data: z.array(z.object({ broadcaster_user_id: z.number(), slug: z.string(), stream_title: z.string(),
  started_at: date, thumbnail: z.string().nullish() })) })

/**
 * Lives em curso de muitos canais de uma vez (ID do canal → lives). Um canal sem entrada está offline.
 * Twitch: 100 canais por pedido. Kick: 50. YouTube: 1 unidade de quota por canal.
 */
export async function readLiveBatch(platform: StreamPlatform, channels: { channel_id: string; channel_url: string }[]): Promise<Map<string, DetectedLive[]>> {
  const result = new Map<string, DetectedLive[]>(channels.map(channel => [channel.channel_id, []]))
  const urlOf = new Map(channels.map(channel => [channel.channel_id, channel.channel_url]))
  if (platform === 'youtube') return readYouTubeLiveBatch(channels.map(channel => channel.channel_id))
  for (const group of chunks(channels.map(channel => channel.channel_id), platform === 'twitch' ? 100 : 50)) {
    const query = group.map(id => `${platform === 'twitch' ? 'user_id' : 'broadcaster_user_id'}=${encodeURIComponent(id)}`).join('&')
    if (platform === 'twitch') {
      for (const stream of twitchStreams.parse(await api('twitch', `https://api.twitch.tv/helix/streams?first=100&${query}`)).data) {
        result.get(stream.user_id)?.push({ external_id: stream.id, title: stream.title, started_at: stream.started_at,
          thumbnail_url: stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360'), watch_url: urlOf.get(stream.user_id)! })
      }
    } else {
      for (const stream of kickLivestreams.parse(await api('kick', `https://api.kick.com/public/v1/livestreams?limit=100&${query}`)).data) {
        const id = String(stream.broadcaster_user_id)
        result.get(id)?.push({ external_id: kickLiveId(id, stream.started_at), title: stream.stream_title || 'Live na Kick',
          started_at: isoSecond(stream.started_at), thumbnail_url: stream.thumbnail || null, watch_url: urlOf.get(id)! })
      }
    }
  }
  // Sem repetidos (a mesma live nunca conta duas vezes, mesmo que venha em dois pedidos).
  for (const [id, lives] of result) result.set(id, lives.filter((live, index) => lives.findIndex(other => other.external_id === live.external_id) === index))
  return result
}
