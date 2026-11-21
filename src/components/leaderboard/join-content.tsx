import { notFound } from 'next/navigation'
import { getLeaderboardBySlug, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { isMockMode, tiktokConnectionAvailable } from '@/lib/providers/registry'
import type { Leaderboard } from '@/lib/db/types'
import { JoinForm, type JoinFormProps } from '@/components/leaderboard/join-form'

/** Estado da participação, calculado no servidor (sem consultas extra à base de dados). */
export function joinFormProps(leaderboard: Leaderboard): Omit<JoinFormProps, 'erro' | 'panel'> {
  const configured = !isDemoLeaderboard(leaderboard.id) && !isMockMode() && tiktokConnectionAvailable()
  const closed = leaderboard.status !== 'active' ||
    Boolean(leaderboard.ends_at && new Date(leaderboard.ends_at).getTime() <= Date.now())
  return { slug: leaderboard.slug, configured, available: configured && !closed, status: leaderboard.status }
}

export async function JoinContent({ slug, erro, panel = false }: { slug: string; erro?: string; panel?: boolean }) {
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) notFound()
  return <JoinForm {...joinFormProps(leaderboard)} slug={slug} erro={erro} panel={panel} />
}
