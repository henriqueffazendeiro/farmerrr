import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, PartyPopper, RefreshCw } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Stat, StatGrid } from '@/components/ui/stat'
import { getLeaderboardTotals, getOwnedLeaderboard } from '@/lib/db/queries'
import { getClippers } from '@/lib/db/board'
import { currentPeriodKey, periodTitle } from '@/lib/period'
import { compactNumber, fullNumber } from '@/lib/format'
import { refreshRankingAction, seedDemoAction } from '@/lib/leaderboards/admin-actions'
import { seedAvailable } from '@/lib/dev/seed'

export default async function LeaderboardOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ criado?: string }>
}) {
  const { id } = await params
  const { criado } = await searchParams

  const leaderboard = await getOwnedLeaderboard(id)
  if (!leaderboard) notFound()

  const periodKey = currentPeriodKey(leaderboard)
  const [totals, clippers] = await Promise.all([
    getLeaderboardTotals(id, periodKey),
    getClippers(id, periodKey),
  ])

  const top = clippers.filter((c) => c.status === 'active').slice(0, 5)

  return (
    <div className="space-y-8">
      {criado === '1' && (
        <div className="flex items-start gap-3 rounded-lg border border-live/25 bg-live/8 p-4">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-live" strokeWidth={1.8} />
          <div>
            <p className="text-sm font-medium text-fg">Leaderboard criado.</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">
              Copia o link de convite ali em cima e partilha-o no Discord ou na stream. Cada
              clipper liga a conta de TikTok e entra no ranking sozinho.
            </p>
          </div>
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-fg-muted">{periodTitle(periodKey)}</h2>
          <form action={refreshRankingAction}>
            <input type="hidden" name="leaderboardId" value={id} />
            <Button type="submit" variant="ghost" size="sm">
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              Atualizar
            </Button>
          </form>
        </div>

        <Card>
          <CardBody className="pt-5">
            <StatGrid>
              <Stat label="Total views" value={fullNumber(totals.total_views)} />
              <Stat label="Clips" value={fullNumber(totals.total_clips)} />
              <Stat label="Clippers ativos" value={fullNumber(totals.active_clippers)} />
              <Stat label="Média / clip" value={fullNumber(totals.avg_views)} />
            </StatGrid>
          </CardBody>
        </Card>
      </section>

      {seedAvailable() && (
        <section>
          <Card className="border-brand-bright/20 bg-brand/5">
            <CardHeader className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
              <CardTitle>Modo de demonstração</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="mb-4 text-sm leading-relaxed text-fg-muted">
                Estás com o provider simulado ligado. Isto cria oito clipfarmers com
                clips e views que crescem a sério — pelo mesmo caminho que um clipper
                real faria. Podes correr outra vez sem duplicar ninguém.
              </p>
              <form action={seedDemoAction}>
                <input type="hidden" name="leaderboardId" value={id} />
                <input type="hidden" name="slug" value={leaderboard.slug} />
                <input type="hidden" name="count" value="8" />
                <Button type="submit" variant="secondary">
                  <FlaskConical className="h-4 w-4" strokeWidth={2} />
                  Encher com clipfarmers de teste
                </Button>
              </form>
            </CardBody>
          </Card>
        </section>
      )}

      <section>
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Top 5</CardTitle>
            <Link
              href={`/dashboard/l/${id}/clippers`}
              className="text-xs text-fg-muted transition-colors hover:text-fg"
            >
              Ver todos
            </Link>
          </CardHeader>
          <CardBody>
            {top.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-muted">
                Ainda ninguém entrou. Partilha o link de convite para começar.
              </p>
            ) : (
              <ul className="divide-y divide-line/50">
                {top.map((clipper, index) => (
                  <li key={clipper.participantId} className="flex items-center gap-3 py-3">
                    <span className="nums w-5 shrink-0 text-center text-sm text-fg-subtle">
                      {index + 1}
                    </span>
                    <Avatar name={clipper.displayName} src={clipper.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{clipper.displayName}</p>
                      {clipper.username ? (
                        <p className="truncate text-xs text-fg-subtle">@{clipper.username}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="nums text-sm font-semibold">
                        {compactNumber(clipper.totalViews)}
                      </p>
                      <p className="nums text-xs text-fg-subtle">
                        {clipper.videoCount} clips
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
