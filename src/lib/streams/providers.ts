import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { publicEnv } from '@/lib/config/env'
import type { DetectedLive, StreamPlatform } from './model'

export function streamConfig(platform: StreamPlatform) {
  const prefix = platform.toUpperCase()
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`] || '',
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] || '',
    redirectUri: `${publicEnv.NEXT_PUBLIC_APP_URL}/api/streams/${platform}/callback`,
    authorize: { twitch: 'https://id.twitch.tv/oauth2/authorize', youtube: 'https://accounts.google.com/o/oauth2/v2/auth', kick: 'https://id.kick.com/oauth/authorize' }[platform],
    token: { twitch: 'https://id.twitch.tv/oauth2/token', youtube: 'https://oauth2.googleapis.com/token', kick: 'https://id.kick.com/oauth/token' }[platform],
    scope: { twitch: '', youtube: 'https://www.googleapis.com/auth/youtube.readonly', kick: 'channel:read' }[platform],
  }
}
export function streamConfigured(platform: StreamPlatform) {
  const config = streamConfig(platform)
  return Boolean(config.clientId && config.clientSecret)
}
export function authorizationUrl(platform: StreamPlatform, state: string, verifier: string) {
  const config = streamConfig(platform)
  const url = new URL(config.authorize)
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: 'code', scope: config.scope, state }).toString()
  if (platform !== 'twitch') {
    url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'))
    url.searchParams.set('code_challenge_method', 'S256')
  }
  if (platform === 'youtube') {
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
  }
  return url
}
export class StreamApiError extends Error {
  constructor(readonly status: number) { super(`A plataforma respondeu com HTTP ${status}.`) }
}
async function request(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new StreamApiError(response.status)
  return response.json()
}
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(), expires_in: z.number().positive() })
export async function exchangeStreamToken(platform: StreamPlatform, grant: { code: string; verifier: string } | { refreshToken: string }) {
  const config = streamConfig(platform)
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret })
  if ('code' in grant) {
    body.set('grant_type', 'authorization_code'); body.set('code', grant.code); body.set('redirect_uri', config.redirectUri)
    if (platform !== 'twitch') body.set('code_verifier', grant.verifier)
  } else { body.set('grant_type', 'refresh_token'); body.set('refresh_token', grant.refreshToken) }
  return tokenSchema.parse(await request(config.token, { method: 'POST', body }))
}
function headers(platform: StreamPlatform, token: string) {
  return { Authorization: `Bearer ${token}`, ...(platform === 'twitch' ? { 'Client-Id': streamConfig(platform).clientId } : {}) }
}
const twitchUsers = z.object({ data: z.array(z.object({ id: z.string(), login: z.string(), display_name: z.string() })) })
const youtubeChannels = z.object({ items: z.array(z.object({ id: z.string(), snippet: z.object({ title: z.string() }) })) })
const kickChannels = z.object({ data: z.array(z.object({ broadcaster_user_id: z.number(), slug: z.string(), stream_title: z.string(),
  stream: z.object({ is_live: z.boolean(), start_time: z.string().optional(), thumbnail: z.string().optional() }) })) })
export async function streamIdentity(platform: StreamPlatform, token: string) {
  const init = { headers: headers(platform, token) }
  if (platform === 'twitch') {
    const user = twitchUsers.parse(await request('https://api.twitch.tv/helix/users', init)).data[0]
    if (!user) throw new Error('Canal não encontrado.')
    return { channel_id: user.id, channel_name: user.display_name, channel_url: `https://www.twitch.tv/${user.login}` }
  }
  if (platform === 'youtube') {
    const user = youtubeChannels.parse(await request('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', init)).items[0]
    if (!user) throw new Error('Esta conta não tem canal YouTube.')
    return { channel_id: user.id, channel_name: user.snippet.title, channel_url: `https://www.youtube.com/channel/${user.id}` }
  }
  const user = kickChannels.parse(await request('https://api.kick.com/public/v1/channels', init)).data[0]
  if (!user) throw new Error('Canal não encontrado.')
  return { channel_id: String(user.broadcaster_user_id), channel_name: user.slug, channel_url: `https://kick.com/${user.slug}` }
}
const twitchStreams = z.object({ data: z.array(z.object({ id: z.string(), title: z.string(), started_at: z.string().datetime({ offset: true }), thumbnail_url: z.string() })) })
const youtubeBroadcasts = z.object({ nextPageToken: z.string().optional(), items: z.array(z.object({ id: z.string(),
  snippet: z.object({ channelId: z.string(), title: z.string(), actualStartTime: z.string().datetime({ offset: true }),
    thumbnails: z.object({ high: z.object({ url: z.string() }).optional() }).optional() }),
  status: z.object({ privacyStatus: z.string() }),
})) })
export async function detectStreams(platform: StreamPlatform, token: string, channelId: string, channelUrl: string): Promise<DetectedLive[]> {
  const init = { headers: headers(platform, token) }
  if (platform === 'twitch') {
    const body = twitchStreams.parse(await request(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(channelId)}`, init))
    return body.data.map(live => ({ external_id: live.id, title: live.title, started_at: live.started_at,
      thumbnail_url: live.thumbnail_url.replace('{width}', '640').replace('{height}', '360'), watch_url: channelUrl }))
  }
  if (platform === 'kick') {
    const body = kickChannels.parse(await request(`https://api.kick.com/public/v1/channels?broadcaster_user_id=${encodeURIComponent(channelId)}`, init))
    const channel = body.data.find(item => String(item.broadcaster_user_id) === channelId)
    if (!channel) throw new Error('Canal Kick indisponível.')
    if (!channel.stream.is_live) return []
    const started = z.string().datetime({ offset: true }).parse(channel.stream.start_time)
    return [{ external_id: `${channelId}:${started}`, title: channel.stream_title, started_at: started,
      thumbnail_url: channel.stream.thumbnail || null, watch_url: channelUrl }]
  }
  const lives: DetectedLive[] = []
  let page: string | undefined
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/liveBroadcasts')
    url.search = new URLSearchParams({ part: 'snippet,status', broadcastStatus: 'active', broadcastType: 'all', maxResults: '50', ...(page ? { pageToken: page } : {}) }).toString()
    const body = youtubeBroadcasts.parse(await request(url.toString(), init))
    for (const live of body.items) {
      if (live.snippet.channelId !== channelId || live.status.privacyStatus !== 'public') continue
      lives.push({ external_id: live.id, title: live.snippet.title, started_at: live.snippet.actualStartTime,
        thumbnail_url: live.snippet.thumbnails?.high?.url || null, watch_url: `https://www.youtube.com/watch?v=${live.id}` })
    }
    page = body.nextPageToken
  } while (page)
  return lives
}
