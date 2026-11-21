import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken, encryptToken } from '@/lib/crypto/tokens'
import { detectStreams, exchangeStreamToken, StreamApiError } from './providers'
import { isPublicMarker, PUBLIC_STREAM_MARKER, readPublicChannel, type PublicChannelSnapshot } from './public-provider'
import { ensureLiveWebhooks } from './webhooks'

export async function syncStreamConnection(id: string, snapshot?: PublicChannelSnapshot) {
  const db = createAdminClient()
  const now = new Date().toISOString()
  const lease = new Date(Date.now() + 5 * 60_000).toISOString()
  const { data: connection, error: claimError } = await db.from('stream_connections')
    .update({ sync_locked_until: lease }).eq('id', id).eq('status', 'connected')
    .lt('sync_locked_until', now).select('*').maybeSingle()
  if (claimError) throw claimError
  if (!connection) return { skipped: true }
  try {
    // Canais públicos: lidos pelas APIs oficiais com as credenciais da app (sem OAuth do streamer).
    const isPublic = isPublicMarker(connection.access_token_enc)
    let token = isPublic ? '' : decryptToken(connection.access_token_enc)
    if (!isPublic && new Date(connection.expires_at).getTime() < Date.now() + 60_000) {
      if (!connection.refresh_token_enc) throw new StreamApiError(401)
      const renewed = await exchangeStreamToken(connection.platform, { refreshToken: decryptToken(connection.refresh_token_enc) })
      token = renewed.access_token
      const { error } = await db.from('stream_connections').update({ access_token_enc: encryptToken(token),
        refresh_token_enc: renewed.refresh_token ? encryptToken(renewed.refresh_token) : connection.refresh_token_enc,
        expires_at: new Date(Date.now() + renewed.expires_in * 1000).toISOString(),
      }).eq('id', id).eq('sync_locked_until', lease)
      if (error) throw error
    }
    // Na primeira verificação de cada dia também se importam as lives passadas (título, thumbnail, início e fim),
    // para o Absolute Cinema não ficar vazio quando uma live começa e acaba entre verificações.
    const history = !connection.last_checked_at || connection.last_checked_at.slice(0, 10) !== now.slice(0, 10)
    const publicData = isPublic ? snapshot ?? await readPublicChannel(connection.platform, connection.channel_url, { history }) : null
    if (publicData && (publicData.channel_id !== connection.channel_id || connection.access_token_enc !== PUBLIC_STREAM_MARKER)) {
      // Ligações antigas (guardadas para o programa no PC, sem ID do canal) ficam com a identidade devolvida pela API.
      if (publicData.channel_id !== connection.channel_id && !connection.channel_id.startsWith('pending:')) throw new Error('O canal mudou de identidade. Volta a ligá-lo.')
      const { error } = await db.from('stream_connections').update({ channel_id: publicData.channel_id, channel_name: publicData.channel_name,
        channel_url: publicData.channel_url, access_token_enc: PUBLIC_STREAM_MARKER }).eq('id', id)
      if (error) throw error
      connection.channel_id = publicData.channel_id
    }
    const streams = publicData ? publicData.streams : await detectStreams(connection.platform, token, connection.channel_id, connection.channel_url)
    // Never infer offline from failed API requests. Only a complete successful response reaches this point.
    const observedAt = new Date().toISOString()
    const { data: previous, error: readError } = await db.from('creator_lives').select('id,external_id,started_at,thumbnail_url,is_live')
      .eq('creator_id', connection.creator_id).eq('platform', connection.platform).eq('channel_id', connection.channel_id)
    if (readError) throw readError
    for (const stream of streams) {
      const existing = previous?.find(row => row.external_id === stream.external_id)
      const { error } = await db.from('creator_lives').upsert({ ...stream, creator_id: connection.creator_id,
        started_at: existing?.started_at ?? stream.started_at,
        thumbnail_url: stream.thumbnail_url ?? existing?.thumbnail_url ?? null,
        platform: connection.platform, channel_id: connection.channel_id, is_live: true, ended_at: null, last_seen_at: observedAt,
      }, { onConflict: 'creator_id,platform,channel_id,external_id' })
      if (error) throw error
    }
    // Lives passadas: só se acrescentam as que ainda não existem (mesmo ID, ou início a menos de 15 min,
    // porque na Twitch a live em direto e a VOD gravada têm IDs diferentes). Nunca se alteram as existentes.
    const known = [...(previous || []), ...streams]
    const missing = (publicData?.past || []).filter(live => !known.some(row => row.external_id === live.external_id
      || Math.abs(new Date(row.started_at).getTime() - new Date(live.started_at).getTime()) < 15 * 60_000))
    if (missing.length) {
      const { error } = await db.from('creator_lives').upsert(missing.map(live => ({ ...live, creator_id: connection.creator_id,
        platform: connection.platform, channel_id: connection.channel_id, is_live: false,
        ended_at: live.ended_at ?? live.started_at, last_seen_at: live.ended_at ?? live.started_at,
      })), { onConflict: 'creator_id,platform,channel_id,external_id', ignoreDuplicates: true })
      if (error) throw error
    }
    const endedIds = (previous || []).filter(live => live.is_live && !streams.some(stream => stream.external_id === live.external_id)).map(live => live.id)
    if (endedIds.length) {
      const { error } = await db.from('creator_lives').update({ is_live: false, ended_at: observedAt }).in('id', endedIds)
      if (error) throw error
    }
    const { error } = await db.from('stream_connections').update({ last_checked_at: observedAt, last_error: null }).eq('id', id)
    if (error) throw error
    // Uma vez por dia: garante (e renova) os avisos em tempo real da plataforma. Uma falha aqui não estraga a verificação.
    if (isPublic && history) await ensureLiveWebhooks({ platform: connection.platform, channel_id: connection.channel_id })
      .catch(webhookError => console.error('[stream webhooks]', connection.platform, webhookError instanceof Error ? webhookError.message : webhookError))
    return { live: streams.length }
  } catch (error) {
    const reauth = error instanceof StreamApiError && [400, 401].includes(error.status)
    await db.from('stream_connections').update({
      last_checked_at: new Date().toISOString(),
      last_error: reauth ? 'Volta a ligar o canal para renovar o acesso.' : 'Não foi possível verificar a transmissão. Vamos tentar novamente.',
      ...(reauth ? { status: 'needs_reauth' as const } : {}),
    }).eq('id', id)
    throw error
  } finally {
    await db.from('stream_connections').update({ sync_locked_until: new Date(0).toISOString() }).eq('id', id).eq('sync_locked_until', lease)
  }
}
