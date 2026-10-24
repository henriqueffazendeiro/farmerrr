import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Creator, Leaderboard } from '@/lib/db/types'

/** O creator do utilizador autenticado (o primeiro, se houver vários). */
export async function getMyCreator(): Promise<Creator | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('creators')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data ?? null
}

export async function getMyLeaderboards(creatorId: string): Promise<Leaderboard[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leaderboards')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function getMyProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return data ?? null
}

/**
 * Leaderboard do utilizador autenticado.
 *
 * A RLS deixa qualquer pessoa ler leaderboards públicos, por isso a posse é
 * confirmada aqui — senão o dashboard de um utilizador abriria a competição
 * de outro (em leitura).
 */
export async function getOwnedLeaderboard(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: leaderboard } = await supabase
    .from('leaderboards')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!leaderboard) return null

  const { data: creator } = await supabase
    .from('creators')
    .select('owner_id')
    .eq('id', leaderboard.creator_id)
    .maybeSingle()

  return creator?.owner_id === user.id ? leaderboard : null
}

export async function getRewards(leaderboardId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rewards')
    .select('*')
    .eq('leaderboard_id', leaderboardId)
    .order('position', { ascending: true })
  return data ?? []
}

/** Totais do período pedido ('all' ou 'YYYY-MM'). */
export async function getLeaderboardTotals(leaderboardId: string, periodKey: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('leaderboard_totals', {
    p_leaderboard_id: leaderboardId,
    p_period_key: periodKey,
  })
  return (
    data?.[0] ?? {
      total_views: 0,
      total_likes: 0,
      total_clips: 0,
      active_clippers: 0,
      avg_views: 0,
    }
  )
}
