import { notFound, redirect } from 'next/navigation'
import { getOwnedLeaderboard } from '@/lib/db/queries'

export default async function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const leaderboard = await getOwnedLeaderboard(id)
  if (!leaderboard) notFound()
  redirect(`/dashboard/l/${id}/definicoes`)
}
