import type { Metadata } from 'next'
import { JoinContent } from '@/components/leaderboard/join-content'
import { getLeaderboardBySlug, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { creatorHasAccess } from '@/lib/billing/stripe'
import { PausedPage } from '@/components/billing/paused'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const leaderboard = await getLeaderboardBySlug(slug)
  return { title: leaderboard ? `Participar · ${leaderboard.name}` : 'Convite não encontrado' }
}

export default async function JoinPage({ params, searchParams }: Props) {
  const [{ slug }, { erro }] = await Promise.all([params, searchParams])
  // Página em pausa (sem subscrição): não aceita novos clippers.
  const leaderboard = await getLeaderboardBySlug(slug)
  if (leaderboard && !isDemoLeaderboard(leaderboard.id) && !await creatorHasAccess(leaderboard.creator_id)) return <PausedPage name={leaderboard.name} />
  return <main><JoinContent slug={slug} erro={erro} /></main>
}
