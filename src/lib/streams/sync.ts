import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken, encryptToken } from '@/lib/crypto/tokens'
import { detectStreams, exchangeStreamToken, StreamApiError } from './providers'

export async function syncStreamConnection(id: string) {
  const db = createAdminClient()
  const now = new Date().toISOString()
  const lease = new Date(Date.now() + 5 * 60_000).toISOString()
  const { data: connection, error: claimError } = await db.from('stream_connections')
    .update({ sync_locked_until: lease }).eq('id', id).eq('status', 'connected')
    .lt('sync_locked_until', now).select('*').maybeSingle()
  if (claimError) throw claimError
  if (!connection) return { skipped: true }
  try {
    let token = decryptToken(connection.access_token_enc)
    if (new Date(connection.expires_at).getTime() < Date.now() + 60_000) {
      if (!connection.refresh_token_enc) throw new StreamApiError(401)
      const renewed = await exchangeStreamToken(connection.platform, { refreshToken: decryptToken(connection.refresh_token_enc) })
      token = renewed.access_token
      const { error } = await db.from('stream_connections').update({ access_token_enc: encryptToken(token),
        refresh_token_enc: renewed.refresh_token ? encryptToken(renewed.refresh_token) : connection.refresh_token_enc,
        expires_at: new Date(Date.now() + renewed.expires_in * 1000).toISOString(),
      }).eq('id', id).eq('sync_locked_until', lease)
      if (error) throw error
    }
    const streams = await detectStreams(connection.platform, token, connection.channel_id, connection.channel_url)
    // Never infer offline from failed API requests. Only a complete successful response reaches this point.
    const observedAt = new Date().toISOString()
    for (const stream of streams) {
      const { error } = await db.from('creator_lives').upsert({ ...stream, creator_id: connection.creator_id,
        platform: connection.platform, channel_id: connection.channel_id, is_live: true, ended_at: null, last_seen_at: observedAt,
      }, { onConflict: 'creator_id,platform,channel_id,external_id' })
      if (error) throw error
    }
    const { data: previous, error: readError } = await db.from('creator_lives').select('id,external_id')
      .eq('creator_id', connection.creator_id).eq('platform', connection.platform).eq('channel_id', connection.channel_id).eq('is_live', true)
    if (readError) throw readError
    const endedIds = (previous || []).filter(live => !streams.some(stream => stream.external_id === live.external_id)).map(live => live.id)
    if (endedIds.length) {
      const { error } = await db.from('creator_lives').update({ is_live: false, ended_at: observedAt }).in('id', endedIds)
      if (error) throw error
    }
    const { error } = await db.from('stream_connections').update({ last_checked_at: observedAt, last_error: null }).eq('id', id)
    if (error) throw error
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
