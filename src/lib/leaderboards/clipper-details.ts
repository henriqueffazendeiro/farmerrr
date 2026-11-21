import 'server-only'
import { getClippers, getLeaderboardBySlug, getVideos, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { availablePeriods } from '@/lib/period'

/**
 * Ganhos do clipper nesta competição: prémios já pagos pelo streamer (pelo site ou à mão), pelo valor do prémio.
 * null quando o streamer oculta as quantias dos prémios.
 */
async function earningsOf(participantId: string) {
  // select('*'): funciona antes e depois da coluna fee_cents existir.
  const { data, error } = await createAdminClient().from('prize_payouts').select('*')
    .eq('participant_id', participantId).in('status', ['available', 'transferring', 'paid'])
  if (error) return 0
  return (data ?? []).reduce((sum, row) => sum + row.amount_cents + (row.fee_cents ?? 0), 0)
}

async function discordOf(clipperProfileId: string) {
  const { data, error } = await createAdminClient().from('clipper_profiles').select('discord').eq('id', clipperProfileId).maybeSingle()
  return error ? null : data?.discord ?? null
}

export async function loadClipperDetails(slug: string, participantId: string, periodKey: string) {
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard || !availablePeriods(leaderboard).includes(periodKey)) return null
  const demo = isDemoLeaderboard(leaderboard.id)
  // Em paralelo: os vídeos e os ganhos não dependem da validação do clipper.
  const [rows, videos, earnings] = await Promise.all([
    getClippers(leaderboard.id, periodKey),
    getVideos(leaderboard, { periodKey, participantId, limit: 60, orderBy: 'views' }),
    demo ? Promise.resolve(0) : earningsOf(participantId),
  ])
  const clipper = rows.find(row => row.participantId === participantId && row.status === 'active')
  if (!clipper) return null
  const discord = demo ? null : await discordOf(clipper.clipperProfileId)
  return { clipper, videos, earningsCents: leaderboard.blur_rewards ? null : earnings, discord }
}
