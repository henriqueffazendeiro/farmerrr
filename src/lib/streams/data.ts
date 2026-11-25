import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentVoterHash, ratingOpen } from '@/lib/lives/ratings'
import type { Live } from '@/components/lives/scale'
import { isStreamPlatform, type StreamPlatform } from './model'

const missingRelation = (code?: string) => code === '42P01' || code === 'PGRST205'

/** Plataforma onde o streamer faz lives: o canal ligado mais recentemente (pode ter um por plataforma). */
export async function getCreatorPlatform(creatorId: string): Promise<StreamPlatform | null> {
  const { data, error } = await createAdminClient().from('stream_connections')
    .select('platform').eq('creator_id', creatorId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return null
  return data && isStreamPlatform(data.platform) ? data.platform : null
}

export async function getCreatorLives(creatorId: string, timezone: string): Promise<Live[]> {
  const db = await createClient()
  const { data, error } = await db.from('creator_lives').select('*').eq('creator_id', creatorId)
    .order('started_at', { ascending: false }).limit(1000)
  if (error) {
    // Existing installations can render while the additive migration is being installed.
    if (missingRelation(error.code)) return []
    throw new Error('Não foi possível carregar as lives.')
  }
  const rows = data || []

  // Notas: média e número de votos (públicos) e o voto deste browser, se já votou.
  const ids = rows.map(row => row.id)
  const voter = await currentVoterHash()
  const admin = createAdminClient()
  const [stats, mine] = ids.length ? await Promise.all([
    admin.from('live_rating_stats').select('live_id, average, count').in('live_id', ids),
    voter ? admin.from('live_ratings').select('live_id, score').eq('voter_hash', voter).in('live_id', ids) : Promise.resolve({ data: [], error: null }),
  ]) : [{ data: [], error: null }, { data: [], error: null }]
  // Sem a tabela de votos (migração 0016 por aplicar), a votação fica fechada em vez de falhar.
  const ratingsReady = !stats.error && !mine.error
  const statsById = new Map((stats.data || []).map(row => [row.live_id, row]))
  const mineById = new Map((mine.data || []).map(row => [row.live_id, row.score]))

  const lives = rows.reverse().map(row => ({
    id: row.id, date: new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(row.started_at)),
    title: row.title, thumbnail: row.thumbnail_url,
    average: statsById.get(row.id)?.average ?? 0, count: statsById.get(row.id)?.count ?? 0,
    open: ratingsReady && ratingOpen(row.started_at, timezone), myVote: mineById.get(row.id),
    // Link para ver: em direto, vídeos do YouTube e VODs gravadas da Twitch (/videos/…).
    // Kick: a API oficial não dá o ID da VOD, por isso as lives terminadas abrem a página de vídeos do canal.
    vod: row.is_live || row.platform === 'youtube' || /\/videos\//.test(row.watch_url) ? row.watch_url
      : row.platform === 'kick' ? `${row.watch_url.replace(/\/+$/, '')}/videos` : null,
    isLive: row.is_live, platform: row.platform, clips: [],
  }))
  // Uma live por dia: se houve várias transmissões no mesmo dia, fica só a última (as linhas vêm por ordem de início).
  return [...new Map(lives.map(live => [live.date, live])).values()]
}
