'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { ensureVoterHash, ratingOpen } from './ratings'

export type RateLiveResult = { ok: true; average: number; count: number; myVote: number } | { ok: false; error: string }

/** Guarda (ou altera) a nota deste browser para uma live. */
export async function rateLive(liveId: string, score: number): Promise<RateLiveResult> {
  if (!/^[0-9a-f-]{36}$/i.test(liveId) || !Number.isInteger(score) || score < 1 || score > 10) return { ok: false, error: 'Nota inválida.' }
  const db = createAdminClient()

  const { data: live } = await db.from('creator_lives').select('id, creator_id, started_at').eq('id', liveId).maybeSingle()
  if (!live) return { ok: false, error: 'Live não encontrada.' }
  // Só lives de competições públicas; o fuso da competição define o "fim do mês".
  const { data: board } = await db.from('leaderboards').select('timezone, is_public, status')
    .eq('creator_id', live.creator_id).eq('is_public', true).neq('status', 'draft').limit(1).maybeSingle()
  if (!board) return { ok: false, error: 'Live não disponível.' }
  if (!ratingOpen(live.started_at, board.timezone || 'Europe/Lisbon')) return { ok: false, error: 'A votação desta live já fechou.' }

  const voter = await ensureVoterHash()
  const { error } = await db.from('live_ratings').upsert(
    { live_id: liveId, voter_hash: voter, score, updated_at: new Date().toISOString() },
    { onConflict: 'live_id,voter_hash' },
  )
  if (error) return { ok: false, error: 'Não foi possível guardar a nota. Tenta novamente.' }

  const { data: stats } = await db.from('live_rating_stats').select('average, count').eq('live_id', liveId).maybeSingle()
  return { ok: true, average: stats?.average ?? score, count: stats?.count ?? 1, myVote: score }
}
