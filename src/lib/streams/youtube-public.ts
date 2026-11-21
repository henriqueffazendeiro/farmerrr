import 'server-only'
import { z } from 'zod'
import type { PublicChannelSnapshot, PastLive } from './public-provider'
import type { DetectedLive } from './model'

export const youtubePublicConfigured = () => Boolean(process.env.YOUTUBE_API_KEY?.trim())

const channelSchema = z.object({ items: z.array(z.object({
  id: z.string().regex(/^UC[\w-]{22}$/), snippet: z.object({ title: z.string() }),
  contentDetails: z.object({ relatedPlaylists: z.object({ uploads: z.string() }) }),
})) })
const playlistSchema = z.object({ items: z.array(z.object({ contentDetails: z.object({ videoId: z.string() }) })) })
const videosSchema = z.object({ items: z.array(z.object({
  id: z.string(), status: z.object({ privacyStatus: z.string() }),
  snippet: z.object({ channelId: z.string(), title: z.string(),
    thumbnails: z.record(z.object({ url: z.string().url() })).optional() }),
  liveStreamingDetails: z.object({ actualStartTime: z.string().datetime({ offset: true }).optional(),
    actualEndTime: z.string().datetime({ offset: true }).optional() }).optional(),
})) })

async function request(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.YOUTUBE_API_KEY?.trim()
  if (!key) throw new Error('Não foi possível consultar o YouTube: falta configurar a chave da API.')
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`)
  url.search = new URLSearchParams(params).toString()
  const response = await fetch(url, { headers: { 'X-Goog-Api-Key': key }, cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    .catch(() => { throw new Error('Não foi possível consultar o YouTube. Tenta novamente mais tarde.') })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const reason = body?.error?.errors?.[0]?.reason
    if (['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'].includes(reason)) {
      throw new Error('Não foi possível consultar o YouTube: a quota da API foi atingida. Tenta mais tarde.')
    }
    throw new Error(`Não foi possível consultar o YouTube (HTTP ${response.status}). Confirma a chave e as restrições da API.`)
  }
  return response.json()
}

const uploadsOf = (channelId: string) => `UU${channelId.slice(2)}`

type VideoItem = z.infer<typeof videosSchema>['items'][number]
const toLive = (video: VideoItem) => {
  const thumbnails = video.snippet.thumbnails
  return { external_id: video.id, title: video.snippet.title, started_at: video.liveStreamingDetails!.actualStartTime!,
    thumbnail_url: thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null,
    watch_url: `https://www.youtube.com/watch?v=${video.id}` }
}

/** videos.list em grupos de 50 (1 unidade de quota por pedido). */
async function videosById(ids: string[]) {
  const videos: VideoItem[] = []
  for (let offset = 0; offset < ids.length; offset += 50) {
    videos.push(...videosSchema.parse(await request('videos', { part: 'snippet,status,liveStreamingDetails', id: ids.slice(offset, offset + 50).join(',') })).items)
  }
  return videos
}

/** Últimos vídeos publicados do canal (1 unidade). Uma live em curso aparece logo no topo dos uploads. */
async function latestUploads(channelId: string, count: number) {
  return playlistSchema.parse(await request('playlistItems', { part: 'contentDetails', playlistId: uploadsOf(channelId), maxResults: String(count) }))
    .items.map(item => item.contentDetails.videoId)
}

/**
 * Lives em curso de vários canais, sem search.list (100 unidades):
 * 1 unidade por canal (uploads) + 1 por cada 50 vídeos. Devolve channelId → lives públicas em direto.
 */
export async function readYouTubeLiveBatch(channelIds: string[]): Promise<Map<string, DetectedLive[]>> {
  const uploads = await Promise.all(channelIds.map(async channelId => [channelId, await latestUploads(channelId, 5)] as const))
  const videos = await videosById([...new Set(uploads.flatMap(([, ids]) => ids))])
  const result = new Map<string, DetectedLive[]>(channelIds.map(id => [id, []]))
  for (const video of videos) {
    const details = video.liveStreamingDetails
    if (!result.has(video.snippet.channelId) || video.status.privacyStatus !== 'public' || !details?.actualStartTime || details.actualEndTime) continue
    result.get(video.snippet.channelId)!.push(toLive(video))
  }
  return result
}

/** Public channel data only: no OAuth or account owner consent is required. */
export async function readYouTubePublic(url: string, history = false): Promise<PublicChannelSnapshot> {
  const path = decodeURIComponent(new URL(url).pathname).replace(/^\/+|\/+$/g, '')
  const filter: Record<string, string> | null = path.startsWith('channel/') ? { id: path.slice(8) }
    : path.startsWith('user/') ? { forUsername: path.slice(5) }
      : path.startsWith('@') ? { forHandle: path } : null
  if (!filter) throw new Error('Introduz o @handle ou o URL /channel/ do YouTube; os endereços /c/ antigos não são suportados.')
  const channel = channelSchema.parse(await request('channels', { part: 'snippet,contentDetails', ...filter })).items[0]
  if (!channel) throw new Error('Não foi possível consultar o canal YouTube. Confirma o @handle.')
  const ids = playlistSchema.parse(await request('playlistItems', { part: 'contentDetails',
    playlistId: channel.contentDetails.relatedPlaylists.uploads, maxResults: history ? '50' : '5' })).items.map(item => item.contentDetails.videoId)
  const streams: DetectedLive[] = []
  const past: PastLive[] = []
  for (const video of await videosById(ids)) {
    if (video.snippet.channelId !== channel.id) throw new Error('O canal devolvido não corresponde ao pedido.')
    const details = video.liveStreamingDetails
    if (video.status.privacyStatus !== 'public' || !details?.actualStartTime) continue
    if (details.actualEndTime) past.push({ ...toLive(video), ended_at: details.actualEndTime })
    else streams.push(toLive(video))
  }
  return { channel_id: channel.id, channel_name: channel.snippet.title,
    channel_url: `https://www.youtube.com/channel/${channel.id}`, streams, past: history ? past : [] }
}
