import { redirect } from 'next/navigation'
import { getMyCreator, getMyLeaderboard } from '@/lib/db/queries'

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ streams?: string }> }) {
  const { streams } = await searchParams
  const creator = await getMyCreator()
  if (!creator) redirect('/dashboard/inicio')
  const leaderboard = await getMyLeaderboard(creator.id)
  const destination = leaderboard ? `/dashboard/l/${leaderboard.id}/definicoes` : '/dashboard/novo'
  redirect(streams ? `${destination}?streams=${encodeURIComponent(streams)}#canais` : `${destination}#conta`)
}
