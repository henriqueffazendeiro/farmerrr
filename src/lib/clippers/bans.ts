import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { LeaderboardParticipant } from '@/lib/db/types'

type Ban = Pick<LeaderboardParticipant, 'status' | 'ban_reason' | 'banned_until'>

/** O ban tem data de fim e essa data já passou: o clipper pode voltar à competição. */
export function banExpired(participant: Ban, now = Date.now()) {
  return participant.status === 'disqualified' && participant.banned_until != null && new Date(participant.banned_until).getTime() <= now
}

/** Termina um ban que já passou da data: volta a ficar ativo e o ranking é recalculado. */
export async function liftExpiredBan(db: ReturnType<typeof createAdminClient>, participant: Pick<LeaderboardParticipant, 'id' | 'leaderboard_id'>) {
  const { data, error } = await db.from('leaderboard_participants').update({ status: 'active', ban_reason: null, banned_until: null })
    .eq('id', participant.id).eq('status', 'disqualified').lte('banned_until', new Date().toISOString()).select('id').maybeSingle()
  if (error) throw error
  if (data) await db.rpc('recompute_leaderboard', { p_leaderboard_id: participant.leaderboard_id })
  return Boolean(data)
}
