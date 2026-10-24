import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { LeaderboardForm } from '@/components/dashboard/leaderboard-form'
import { createLeaderboardAction } from '@/lib/leaderboards/actions'
import { getMyCreator } from '@/lib/db/queries'

export const metadata: Metadata = { title: 'Criar leaderboard' }

export default async function NewLeaderboardPage() {
  const creator = await getMyCreator()
  if (!creator) redirect('/dashboard/inicio')

  return (
    <div className="mx-auto max-w-[640px]">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Leaderboards
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Criar leaderboard</h1>
      <p className="mt-2 mb-8 text-sm leading-relaxed text-fg-muted">
        Só o nome e a data de início são obrigatórios. Tudo o resto pode ficar para depois.
      </p>

      <LeaderboardForm
        mode="create"
        action={createLeaderboardAction}
        creatorName={creator.name}
        defaultSlug={creator.handle}
      />
    </div>
  )
}
