import { notFound } from 'next/navigation'
import { getOwnedLeaderboard } from '@/lib/db/queries'
import { BackButton } from '@/components/dashboard/back-button'

export default async function LeaderboardAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const leaderboard = await getOwnedLeaderboard(id)
  if (!leaderboard) notFound()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Definições</h1>
            {leaderboard.status !== 'active' && (
              <span className="text-xs text-fg-subtle">Terminado</span>
            )}
          </div>
        </div>
        <BackButton fallback={`/${leaderboard.slug}`} />
      </div>

      <div className="mt-10">{children}</div>
    </div>
  )
}
