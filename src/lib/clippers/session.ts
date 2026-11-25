import 'server-only'
import { readClipperSession } from '@/lib/recap/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { banExpired, liftExpiredBan } from './bans'

export async function getClipperMembership(slug: string) {
  const session = await readClipperSession()
  if (!session) return null
  const db = createAdminClient()
  const { data: participant, error } = await db.from('leaderboard_participants').select('*').eq('id', session.participantId).maybeSingle()
  if (error) throw error
  if (!participant) return null
  // Ban que já chegou ao fim: o clipper volta ao ranking sem ter de se inscrever outra vez.
  if (banExpired(participant) && await liftExpiredBan(db, participant)) Object.assign(participant, { status: 'active', ban_reason: null, banned_until: null })
  const { data: board } = await db.from('leaderboards').select('*').eq('id', participant.leaderboard_id).eq('slug', slug).maybeSingle()
  if (!board) return null
  const { data: account, error: accountError } = await db.from('social_accounts')
    .select('id,username,display_name,status,last_synced_at').eq('clipper_profile_id', participant.clipper_profile_id).eq('provider', 'tiktok').maybeSingle()
  if (accountError) throw accountError
  return { participant, board, account }
}
