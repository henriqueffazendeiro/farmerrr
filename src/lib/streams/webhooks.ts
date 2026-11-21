import 'server-only'
import { createHmac, createVerify, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StreamPlatform } from './model'
import { api, ApiError, isoSecond, kickLiveId, publicStreamsConfigured, twitchThumbnail, type PublicChannelSnapshot } from './public-provider'
import { syncStreamConnection } from './sync'

/**
 * Avisos em tempo real das plataformas (em vez de perguntar de X em X minutos):
 * - Twitch: EventSub stream.online / stream.offline (token da app, sem o streamer autorizar nada);
 * - Kick: livestream.status.updated (o URL do webhook é o configurado na app da Kick);
 * - YouTube: WebSub (PubSubHubbub) — avisa quando o canal publica/inicia um vídeo; confirma-se com 1 unidade de quota.
 * A verificação periódica continua como rede de segurança.
 */

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
/** Os webhooks só funcionam num endereço público HTTPS (não em localhost). */
export const webhooksAvailable = () => appUrl().startsWith('https://') && Boolean(process.env.CRON_SECRET)
const secret = (name: string) => createHmac('sha256', process.env.CRON_SECRET || '').update(`farmerrr-webhook:${name}`).digest('hex')
const callback = (platform: StreamPlatform) => `${appUrl()}/api/webhooks/${platform}`
const youtubeTopic = (channelId: string) => `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`

const sameText = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

// ─── Subscrições ───

const twitchSubs = z.object({ data: z.array(z.object({ id: z.string(), type: z.string(), status: z.string(),
  condition: z.object({ broadcaster_user_id: z.string().optional() }), transport: z.object({ callback: z.string().optional() }) })) })
const kickSubs = z.object({ data: z.array(z.object({ id: z.string(), event: z.string(), broadcaster_user_id: z.number() })) })

/** Garante que a plataforma avisa quando este canal entra/sai de live. Idempotente: pode ser chamado todos os dias. */
export async function ensureLiveWebhooks(connection: { platform: StreamPlatform; channel_id: string }) {
  if (!webhooksAvailable() || !publicStreamsConfigured(connection.platform) || connection.channel_id.startsWith('pending:')) return
  const id = connection.channel_id
  if (connection.platform === 'twitch') {
    const existing = twitchSubs.parse(await api('twitch', `https://api.twitch.tv/helix/eventsub/subscriptions?user_id=${id}`)).data
      .filter(sub => sub.transport.callback === callback('twitch'))
    for (const type of ['stream.online', 'stream.offline']) {
      const current = existing.find(sub => sub.type === type)
      if (current?.status === 'enabled' || current?.status === 'webhook_callback_verification_pending') continue
      if (current) await api('twitch', `https://api.twitch.tv/helix/eventsub/subscriptions?id=${current.id}`, { method: 'DELETE' })
      await api('twitch', 'https://api.twitch.tv/helix/eventsub/subscriptions', { method: 'POST', body: { type, version: '1',
        condition: { broadcaster_user_id: id }, transport: { method: 'webhook', callback: callback('twitch'), secret: secret('twitch') } } })
        .catch(error => { if (!(error instanceof ApiError && error.status === 409)) throw error })
    }
    return
  }
  if (connection.platform === 'kick') {
    const existing = kickSubs.parse(await api('kick', `https://api.kick.com/public/v1/events/subscriptions?broadcaster_user_id=${id}`)).data
    if (existing.some(sub => sub.event === 'livestream.status.updated' && String(sub.broadcaster_user_id) === id)) return
    await api('kick', 'https://api.kick.com/public/v1/events/subscriptions', { method: 'POST', body: {
      broadcaster_user_id: Number(id), events: [{ name: 'livestream.status.updated', version: 1 }], method: 'webhook' } })
    return
  }
  // YouTube: a subscrição dura no máximo ~10 dias; renova-se todos os dias.
  await youtubeHub('subscribe', id)
}

export async function removeLiveWebhooks(connection: { platform: StreamPlatform; channel_id: string }) {
  if (!webhooksAvailable() || !publicStreamsConfigured(connection.platform) || connection.channel_id.startsWith('pending:')) return
  const id = connection.channel_id
  if (connection.platform === 'twitch') {
    const subs = twitchSubs.parse(await api('twitch', `https://api.twitch.tv/helix/eventsub/subscriptions?user_id=${id}`)).data
    for (const sub of subs.filter(item => item.transport.callback === callback('twitch'))) {
      await api('twitch', `https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, { method: 'DELETE' })
    }
  } else if (connection.platform === 'kick') {
    const subs = kickSubs.parse(await api('kick', `https://api.kick.com/public/v1/events/subscriptions?broadcaster_user_id=${id}`)).data
    for (const sub of subs) await api('kick', `https://api.kick.com/public/v1/events/subscriptions?id=${encodeURIComponent(sub.id)}`, { method: 'DELETE' })
  } else {
    await youtubeHub('unsubscribe', id)
  }
}

async function youtubeHub(mode: 'subscribe' | 'unsubscribe', channelId: string) {
  const response = await fetch('https://pubsubhubbub.appspot.com/subscribe', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12_000),
    body: new URLSearchParams({ 'hub.mode': mode, 'hub.topic': youtubeTopic(channelId), 'hub.callback': callback('youtube'),
      'hub.verify': 'async', 'hub.secret': secret('youtube'), 'hub.lease_seconds': String(10 * 86400) }) })
  if (!response.ok && response.status !== 202) throw new Error(`O hub do YouTube respondeu HTTP ${response.status}.`)
}

// ─── Processar um aviso ───

async function connectionFor(platform: StreamPlatform, channelId: string) {
  const { data } = await createAdminClient().from('stream_connections').select('id,channel_id,channel_name,channel_url')
    .eq('platform', platform).eq('channel_id', channelId).eq('status', 'connected')
  return data ?? []
}

/** Aplica o estado recebido; se o canal estiver a meio de outra verificação, tenta de novo uns segundos depois. */
async function apply(id: string, snapshot?: PublicChannelSnapshot) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await syncStreamConnection(id, snapshot)
    if (!('skipped' in result)) return
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
}

const twitchChannel = z.object({ data: z.array(z.object({ title: z.string(), broadcaster_login: z.string() })) })

export async function handleTwitchEvent(type: string, event: { broadcaster_user_id: string; broadcaster_user_login?: string; id?: string; started_at?: string }) {
  for (const connection of await connectionFor('twitch', event.broadcaster_user_id)) {
    const base = { channel_id: connection.channel_id, channel_name: connection.channel_name, channel_url: connection.channel_url }
    if (type === 'stream.offline') { await apply(connection.id, { ...base, streams: [] }); continue }
    if (!event.id || !event.started_at) continue
    const info = twitchChannel.parse(await api('twitch', `https://api.twitch.tv/helix/channels?broadcaster_id=${event.broadcaster_user_id}`)).data[0]
    const login = info?.broadcaster_login ?? event.broadcaster_user_login ?? ''
    await apply(connection.id, { ...base, streams: [{ external_id: event.id, title: info?.title || 'Live na Twitch',
      started_at: event.started_at, thumbnail_url: login ? twitchThumbnail(login) : null, watch_url: connection.channel_url }] })
  }
}

export const kickEventSchema = z.object({ broadcaster: z.object({ user_id: z.number() }), is_live: z.boolean(),
  title: z.string().nullish(), started_at: z.string().nullish() })

export async function handleKickEvent(event: z.infer<typeof kickEventSchema>) {
  const id = String(event.broadcaster.user_id)
  for (const connection of await connectionFor('kick', id)) {
    const base = { channel_id: connection.channel_id, channel_name: connection.channel_name, channel_url: connection.channel_url }
    const started = event.started_at && !Number.isNaN(Date.parse(event.started_at)) ? event.started_at : null
    // Sem hora de início não há ID estável: deixa a confirmação para a leitura normal da API.
    await apply(connection.id, event.is_live && started ? { ...base, streams: [{ external_id: kickLiveId(id, started),
      title: event.title || 'Live na Kick', started_at: isoSecond(started), thumbnail_url: null, watch_url: connection.channel_url }] }
      : event.is_live ? undefined : { ...base, streams: [] })
  }
}

/** YouTube: o aviso só diz "este canal publicou/alterou um vídeo"; a leitura normal (barata) confirma se há live. */
export async function handleYouTubeEvent(channelId: string) {
  for (const connection of await connectionFor('youtube', channelId)) await apply(connection.id)
}

// ─── Verificação das assinaturas ───

export function verifyTwitch(headers: Headers, body: string) {
  const id = headers.get('twitch-eventsub-message-id') ?? ''
  const timestamp = headers.get('twitch-eventsub-message-timestamp') ?? ''
  const signature = headers.get('twitch-eventsub-message-signature') ?? ''
  // Rejeita avisos com mais de 10 minutos (repetições maliciosas).
  if (!id || Math.abs(Date.now() - Date.parse(timestamp)) > 10 * 60_000) return false
  return sameText(signature, `sha256=${createHmac('sha256', secret('twitch')).update(id + timestamp + body).digest('hex')}`)
}

let kickKey: { pem: string; at: number } | null = null
const kickKeySchema = z.object({ data: z.object({ public_key: z.string().min(1) }) })

export async function verifyKick(headers: Headers, body: string) {
  const id = headers.get('kick-event-message-id') ?? ''
  const timestamp = headers.get('kick-event-message-timestamp') ?? ''
  const signature = headers.get('kick-event-signature') ?? ''
  if (!id || !timestamp || !signature) return false
  for (const refresh of [false, true]) {
    if (refresh || !kickKey || Date.now() - kickKey.at > 86_400_000) {
      const response = await fetch('https://api.kick.com/public/v1/public-key', { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      if (!response.ok) return false
      kickKey = { pem: kickKeySchema.parse(await response.json()).data.public_key, at: Date.now() }
    }
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${id}.${timestamp}.${body}`)
    if (verifier.verify(kickKey.pem, signature, 'base64')) return true
  }
  return false
}

export function verifyYouTube(headers: Headers, body: string) {
  const signature = headers.get('x-hub-signature') ?? ''
  return sameText(signature, `sha1=${createHmac('sha1', secret('youtube')).update(body).digest('hex')}`)
}

export async function youtubeChannelConnected(channelId: string) {
  return (await connectionFor('youtube', channelId)).length > 0
}
