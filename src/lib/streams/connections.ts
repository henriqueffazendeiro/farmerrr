import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeLiveWebhooks } from './webhooks'

/**
 * O streamer faz lives numa plataforma de cada vez: ao ligar um canal novo, os outros deixam de estar associados.
 * Só se apaga a ligação ao canal. As lives (creator_lives) pertencem ao streamer, não ao canal,
 * por isso as lives antigas, as avaliações e os clips associados continuam guardados
 * (ex.: o streamer mudou de plataforma ou foi banido da anterior).
 */
export async function keepOnlyConnection(creatorId: string, keepId: string) {
  const db = createAdminClient()
  const { data: removed, error } = await db.from('stream_connections').delete()
    .eq('creator_id', creatorId).neq('id', keepId).select('platform,channel_id')
  if (error) throw error
  for (const connection of removed ?? []) {
    // Deixa de receber avisos deste canal, se mais nenhum perfil o tiver ligado.
    const { count: others } = await db.from('stream_connections').select('id', { count: 'exact', head: true })
      .eq('platform', connection.platform).eq('channel_id', connection.channel_id)
    if (others === 0) await removeLiveWebhooks(connection).catch(() => undefined)
    // Uma live que estivesse a decorrer no canal antigo fica terminada (continua no histórico).
    await db.from('creator_lives').update({ is_live: false, ended_at: new Date().toISOString() })
      .eq('creator_id', creatorId).eq('platform', connection.platform).eq('channel_id', connection.channel_id).eq('is_live', true)
  }
}
