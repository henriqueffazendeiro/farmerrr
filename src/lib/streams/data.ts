import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Live } from '@/components/lives/scale'

export async function getCreatorLives(creatorId: string, timezone: string): Promise<Live[]> {
  const db = await createClient()
  const { data, error } = await db.from('creator_lives').select('*').eq('creator_id', creatorId)
    .order('started_at', { ascending: false }).limit(1000)
  if (error) {
    // Existing installations can render while the additive migration is being installed.
    if (error.code === '42P01' || error.code === 'PGRST205') return []
    throw new Error('Não foi possível carregar as lives.')
  }
  return (data || []).reverse().map(row => ({
    id: row.id, date: new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(row.started_at)),
    title: row.title, average: 0, count: 0, open: false, thumbnail: row.thumbnail_url,
    vod: row.is_live || row.platform === 'youtube' ? row.watch_url : null,
    isLive: row.is_live, platform: row.platform, clips: [],
  }))
}
