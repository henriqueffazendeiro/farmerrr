import 'server-only'

import { cache } from 'react'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { Creator, Leaderboard, Reward } from '@/lib/db/types'

/** O creator do utilizador autenticado (o primeiro, se houver vários). */
export const getMyCreator = cache(async function getMyCreator(): Promise<Creator | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()

  const { data } = await supabase
    .from('creators')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data ?? null
})

export const getMyLeaderboard = cache(async function getMyLeaderboard(creatorId: string): Promise<Leaderboard | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leaderboards')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data ?? null
})

export const getMyProfile = cache(async function getMyProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return data ?? null
})

/**
 * Leaderboard do utilizador autenticado.
 *
 * A RLS deixa qualquer pessoa ler leaderboards públicos, por isso a posse é
 * confirmada aqui — senão o dashboard de um utilizador abriria a competição
 * de outro (em leitura).
 */
export const getOwnedLeaderboard = cache(async function getOwnedLeaderboard(id: string) {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()

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
})

export async function getRewards(leaderboardId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rewards')
    .select('*')
    .eq('leaderboard_id', leaderboardId)
    .order('position', { ascending: true })
  return data ?? []
}

/**
 * Prémios para a página pública. Com "ocultar quantias", o valor nunca sai do
 * servidor: a view rewards_public (migração 0015) já o devolve a null; até a
 * migração estar aplicada, lê a tabela e tira-o aqui.
 */
export async function getPublicRewards(leaderboard: Pick<Leaderboard, 'id' | 'blur_rewards'>): Promise<Reward[]> {
  const supabase = await createClient()
  const view = await supabase.from('rewards_public').select('*')
    .eq('leaderboard_id', leaderboard.id).order('position', { ascending: true })
  const rows: Reward[] = view.error ? await getRewards(leaderboard.id) : view.data ?? []
  if (!leaderboard.blur_rewards) return rows
  return rows.map(row => row.amount_cents == null ? row : { ...row, amount_cents: null, amount_hidden: true })
}

/** Totais do período pedido ('all' ou 'YYYY-MM'). */
export async function getLeaderboardTotals(leaderboardId: string, periodKey: string) {
  const supabase = await createClient()
  const { data } = await supabase.rpc('leaderboard_totals', {
    p_leaderboard_id: leaderboardId,
    p_period_key: periodKey === 'all' ? 'history' : periodKey,
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
