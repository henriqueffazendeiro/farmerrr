import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getMyCreator, getMyLeaderboard } from '@/lib/db/queries'

export const metadata: Metadata = { title: 'A minha página' }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ streams?: string }> }) {
  const { streams } = await searchParams
  const creator = await getMyCreator()
  if (!creator) redirect('/dashboard/novo')

  const leaderboard = await getMyLeaderboard(creator.id)
  const destination = leaderboard ? (streams ? `/dashboard/l/${leaderboard.id}/definicoes` : `/${leaderboard.slug}`) : '/dashboard/novo'
  redirect(streams ? `${destination}?streams=${encodeURIComponent(streams)}#canais` : destination)
}
