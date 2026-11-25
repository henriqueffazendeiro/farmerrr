'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyCreator, getMyLeaderboard, getOwnedLeaderboard } from '@/lib/db/queries'
import { seedAvailable, seedDemoCompetition, seedLeaderboard } from '@/lib/dev/seed'
import { createAdminClient } from '@/lib/supabase/admin'
import { recomputeHistoryForAccount } from '@/lib/sync/history'

async function slugOf(leaderboardId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leaderboards')
    .select('slug')
    .eq('id', leaderboardId)
    .maybeSingle()
  return data?.slug ?? null
}

/** Só o dono da competição pode gerir: sem isto, qualquer pessoa disparava o recálculo (com a chave de admin). */
async function isOwner(leaderboardId: string) {
  return Boolean(leaderboardId && await getOwnedLeaderboard(leaderboardId))
}

/** Recalcula o ranking. Chamar só depois de isOwner(). */
async function refresh(leaderboardId: string) {
  const supabase = await createClient()
  await createAdminClient().rpc('recompute_leaderboard', { p_leaderboard_id: leaderboardId })

  // Keep history totals consistent with exclusions and participation changes.
  // Resolve membership through the caller's RLS before doing derived writes.
  const { data: participants } = await supabase.from('leaderboard_participants')
    .select('clipper_profile_id').eq('leaderboard_id', leaderboardId).eq('status', 'active')
  if (participants?.length) {
    const admin = createAdminClient()
    const { data: accounts, error } = await admin.from('social_accounts').select('id,clipper_profile_id')
      .in('clipper_profile_id', participants.map(p => p.clipper_profile_id))
    if (error) throw error
    const seen = new Set<string>()
    for (const account of accounts ?? []) {
      if (seen.has(account.clipper_profile_id)) continue
      seen.add(account.clipper_profile_id)
      await recomputeHistoryForAccount(admin, account.id)
    }
  }

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
  if (!await isOwner(leaderboardId)) return

  const supabase = await createClient()
  await supabase
    .from('leaderboard_participants')
    .update(status === 'active' ? { status, ban_reason: null, banned_until: null } : { status })
    .eq('id', participantId)
    .eq('leaderboard_id', leaderboardId)

  await refresh(leaderboardId)
}

/**
 * Banir a partir do perfil do clipper na página pública (por tempo indeterminado): sai do ranking e dos prémios
 * e não se pode voltar a inscrever nesta competição. Os vídeos e o histórico ficam guardados.
 */
export async function banClipperAction(leaderboardId: string, participantId: string, ban: { reason: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!leaderboardId || !participantId) return { ok: false, error: 'Clipper inválido.' }
  const reason = String(ban?.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'Escreve o motivo do banimento.' }
  if (reason.length > 500) return { ok: false, error: 'O motivo pode ter no máximo 500 caracteres.' }
  if (!await isOwner(leaderboardId)) return { ok: false, error: 'Só o dono da competição pode banir clippers.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('leaderboard_participants').update({ status: 'disqualified', ban_reason: reason, banned_until: null })
    .eq('id', participantId).eq('leaderboard_id', leaderboardId).select('id').maybeSingle()
  if (error || !data) return { ok: false, error: 'Não foi possível banir o clipper. Tenta novamente.' }
  // Só o ranking desta competição muda: não é preciso recalcular o histórico de todos os clippers (refresh), que era lento.
  await createAdminClient().rpc('recompute_leaderboard', { p_leaderboard_id: leaderboardId })
  const slug = await slugOf(leaderboardId)
  if (slug) { revalidateTag(`lb:${slug}`); revalidatePath(`/${slug}`) }
  return { ok: true }
}

/** Exclui um vídeo desta competição (não o apaga nem o afeta noutras). */
export async function excludeVideoAction(formData: FormData) {
  const leaderboardId = String(formData.get('leaderboardId') ?? '')
  const videoId = String(formData.get('videoId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim() || null

  if (!leaderboardId || !videoId) return
  if (!await isOwner(leaderboardId)) return

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
  if (!await isOwner(leaderboardId)) return

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
  if (!await isOwner(leaderboardId)) return
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
  const owned = await getOwnedLeaderboard(leaderboardId)
  if (!owned || owned.slug !== slug) return
  await seedLeaderboard(slug, count)

  await refresh(leaderboardId)
}

/**
 * Monta a competição de demonstração completa (creator, leaderboard,
 * prémios e dez clipfarmers) e leva o utilizador para lá.
 */
export async function createDemoCompetitionAction() {
  if (!seedAvailable()) return
  const creator = await getMyCreator()
  if (creator) {
    const existing = await getMyLeaderboard(creator.id)
    if (existing) redirect(`/dashboard/l/${existing.id}/definicoes`)
  }

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

  if (board) redirect(`/dashboard/l/${board.id}/definicoes`)
}
