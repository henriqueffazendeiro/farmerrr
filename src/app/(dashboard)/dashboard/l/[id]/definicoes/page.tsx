import { notFound, redirect } from 'next/navigation'
import { Flag, Play } from 'lucide-react'
import { LeaderboardForm } from '@/components/dashboard/leaderboard-form'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { getMyCreator, getOwnedLeaderboard, getRewards } from '@/lib/db/queries'
import {
  endLeaderboardAction,
  reopenLeaderboardAction,
  updateLeaderboardAction,
} from '@/lib/leaderboards/actions'

export const metadata = { title: 'Definições' }

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [leaderboard, creator] = await Promise.all([getOwnedLeaderboard(id), getMyCreator()])
  if (!leaderboard) notFound()
  if (!creator) redirect('/dashboard/inicio')

  const rewards = await getRewards(id)

  return (
    <div className="space-y-8">
      <LeaderboardForm
        mode="edit"
        action={updateLeaderboardAction}
        creatorName={creator.name}
        defaultSlug={creator.handle}
        leaderboard={leaderboard}
        rewards={rewards}
      />

      <Card className="border-line/60">
        <CardHeader>
          <CardTitle>
            {leaderboard.status === 'active' ? 'Terminar competição' : 'Reabrir competição'}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-sm leading-relaxed text-fg-muted">
            {leaderboard.status === 'active'
              ? 'A página pública continua acessível e o ranking congela no estado final. Podes reabrir depois.'
              : 'A competição volta a contar clips novos a partir de agora.'}
          </p>
          <form action={leaderboard.status === 'active' ? endLeaderboardAction : reopenLeaderboardAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant={leaderboard.status === 'active' ? 'danger' : 'secondary'}>
              {leaderboard.status === 'active' ? (
                <>
                  <Flag className="h-4 w-4" strokeWidth={2} />
                  Terminar competição
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" strokeWidth={2} />
                  Reabrir competição
                </>
              )}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
