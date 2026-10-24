import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { demoVideos, demoClippers } from '@/lib/leaderboards/demo'
import { currentPeriodKey } from '@/lib/period'
import type { Leaderboard } from '@/lib/db/types'
import type { MonthlyRecap } from './model'

export async function getRecaps(lb: Leaderboard): Promise<MonthlyRecap[]> {
  if (isDemoLeaderboard(lb.id)) {
    const [year, month] = currentPeriodKey(lb).split('-').map(Number)
    return [1, 2, 3].map(offset => {
      const period = new Date(Date.UTC(year, month - 1 - offset, 1)).toISOString().slice(0, 7)
      const people = demoClippers(period)
      return { id: `demo-${period}`, leaderboard_id: lb.id, period_key: period,
        created_at: new Date(Date.UTC(year, month - offset, 1)).toISOString(), winner_video_path: null,
        snapshot: { videos: people.flatMap((person, personIndex) => Array.from({ length: person.videoCount }, (_, i) => {
          const sample = demoVideos(period)[personIndex]
          const total = Math.round(person.totalViews * (1 - (offset - 1) * 0.13))
          const first = Math.round(total * 0.28)
          const rest = Math.floor((total - first) / (person.videoCount - 1))
          const views = i === 0 ? first : i === person.videoCount - 1 ? total - first - rest * (i - 1) : rest
          return { id: `${person.participantId}-${i}`, participantId: person.participantId,
            name: person.displayName, avatar: person.avatarUrl, thumbnail: sample.thumbnail_url,
            caption: sample.caption, url: null, views, likes: Math.round(views * (personIndex === 1 ? 0.09 : 0.048)),
            shares: Math.round(views * (personIndex === 2 ? 0.035 : 0.009)), comments: Math.round(views * 0.001) }
        })) } }
    })
  }
  const client = await createClient()
  const { data, error } = await client.from('monthly_recaps').select('*').eq('leaderboard_id', lb.id).order('period_key', { ascending: false })
  if (error) throw new Error('Não foi possível carregar os recaps. Verifica a migração 0006.')
  return data ?? []
}

export async function winnerVideoUrl(recap: MonthlyRecap | undefined) {
  if (!recap?.winner_video_path) return null
  const { data, error } = await createAdminClient().storage.from('recap-videos').createSignedUrl(recap.winner_video_path, 3600)
  if (error) throw new Error('Não foi possível carregar o vídeo do vencedor.')
  return data.signedUrl
}
