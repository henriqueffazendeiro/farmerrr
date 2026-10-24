'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { seedAvailable, seedDemoCompetition, seedLeaderboard } from '@/lib/dev/seed'

async function slugOf(leaderboardId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leaderboards')
    .select('slug')
    .eq('id', leaderboardId)
    .maybeSingle()
  return data?.slug ?? null
}

async function refresh(leaderboardId: string) {
  const supabase = await createClient()
  await supabase.rpc('recompute_leaderboard', { p_leaderboard_id: leaderboardId })

  const slug = await slugOf(leaderboardId)
  if (slug) revalidateTag(`lb:${slug}`)
  revalidatePath(`/dashboard/l/${leaderboardId}`, 'layout')
}

/** Desqualifica um clipper: sai do ranking, mas o histórico fica. */
export async function setParticipantStatusAction(formData: FormData) {
  const leaderboardId = String(formData.get('leaderboardId') ?? '')
  const participantId = String(formData.get('participantId') ?? '')
  const status = String(formData.get('status') ?? '')

  if (!leaderboardId || !participantId) return
  if (status !== 'active' && status !== 'disqualified') return

  const supabase = await createClient()
  await supabase
    .from('leaderboard_participants')
    .update({ status })
    .eq('id', participantId)
    .eq('leaderboard_id', leaderboardId)

  await refresh(leaderboardId)
}

/** Exclui um vídeo desta competição (não o apaga nem o afeta noutras). */
export async function excludeVideoAction(formData: FormData) {
  const leaderboardId = String(formData.get('leaderboardId') ?? '')
  const videoId = String(formData.get('videoId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim() || null

  if (!leaderboardId || !videoId) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('video_exclusions').insert({
    leaderboard_id: leaderboardId,
    video_id: videoId,
    excluded_by: user?.id ?? null,
    reason,
  })

  await refresh(leaderboardId)
}

export async function includeVideoAction(formData: FormData) {
  const leaderboardId = String(formData.get('leaderboardId') ?? '')
  const videoId = String(formData.get('videoId') ?? '')
  if (!leaderboardId || !videoId) return

  const supabase = await createClient()
  await supabase
    .from('video_exclusions')
    .delete()
    .eq('leaderboard_id', leaderboardId)
    .eq('video_id', videoId)

  await refresh(leaderboardId)
}

/** Botão "Atualizar" — recalcula o ranking com os dados que já existem. */
export async function refreshRankingAction(formData: FormData) {
  const leaderboardId = String(formData.get('leaderboardId') ?? '')
  if (!leaderboardId) return
  await refresh(leaderboardId)
}

/**
 * Enche a competição com clipfarmers simulados (só em desenvolvimento, com
 * SOCIAL_PROVIDER=mock). Serve para ter o que mostrar sem andar a abrir o
 * link de convite uma dúzia de vezes.
 */
export async function seedDemoAction(formData: FormData) {
  const leaderboardId = String(formData.get('leaderboardId') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const count = Number(formData.get('count') ?? 8)
  if (!leaderboardId || !slug) return

  if (!seedAvailable()) return
  await seedLeaderboard(slug, count)

  await refresh(leaderboardId)
}

/**
 * Monta a competição de demonstração completa (creator, leaderboard,
 * prémios e dez clipfarmers) e leva o utilizador para lá.
 */
export async function createDemoCompetitionAction() {
  if (!seedAvailable()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/entrar')

  const result = await seedDemoCompetition(user.id)

  const { data: board } = await supabase
    .from('leaderboards')
    .select('id')
    .eq('slug', result.slug)
    .maybeSingle()

  revalidateTag(`lb:${result.slug}`)
  revalidatePath('/dashboard')

  if (board) redirect(`/dashboard/l/${board.id}`)
}
