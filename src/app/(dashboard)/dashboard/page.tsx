import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowUpRight, FlaskConical, Plus, Trophy } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Badge, LiveDot } from '@/components/ui/badge'
import { getMyCreator, getMyLeaderboards } from '@/lib/db/queries'
import { shortDate, timeRemaining } from '@/lib/format'
import { publicEnv } from '@/lib/config/env'
import { seedAvailable } from '@/lib/dev/seed'
import { createDemoCompetitionAction } from '@/lib/leaderboards/admin-actions'

export const metadata: Metadata = { title: 'Leaderboards' }

export default async function DashboardPage() {
  const creator = await getMyCreator()
  if (!creator) redirect('/dashboard/inicio')

  const leaderboards = await getMyLeaderboards(creator.id)
  const host = publicEnv.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')

  return (
    <div className="mx-auto max-w-[860px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboards</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {leaderboards.length === 0
              ? 'Ainda não tens nenhum.'
              : `${leaderboards.length} ${leaderboards.length === 1 ? 'competição' : 'competições'}`}
          </p>
        </div>
        <ButtonLink href="/dashboard/novo">
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Criar leaderboard
        </ButtonLink>
      </div>

      {leaderboards.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line-strong bg-surface/40 px-6 py-16 text-center">
          <Trophy className="mx-auto h-8 w-8 text-fg-subtle" strokeWidth={1.5} />
          <h2 className="mt-5 text-base font-semibold tracking-tight">
            Cria a tua primeira competição
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
            Demora dois minutos. Depois partilhas um link e os clippers ligam-se sozinhos.
          </p>
          <div className="mt-7 flex justify-center">
            <ButtonLink href="/dashboard/novo" size="lg">
              Criar leaderboard
            </ButtonLink>
          </div>

          {seedAvailable() && (
            <div className="mx-auto mt-10 max-w-sm border-t border-line pt-7">
              <p className="text-sm leading-relaxed text-fg-muted">
                Ou monta uma competição de demonstração já preenchida — creator,
                prémios, aviso, contagem decrescente e dez clipfarmers com clips a
                render views.
              </p>
              <form action={createDemoCompetitionAction} className="mt-5 flex justify-center">
                <Button type="submit" variant="secondary">
                  <FlaskConical className="h-4 w-4" strokeWidth={2} />
                  Criar competição de demonstração
                </Button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {leaderboards.map((lb) => {
            const remaining = timeRemaining(lb.ends_at)
            return (
              <li key={lb.id}>
                <Link
                  href={`/dashboard/l/${lb.id}`}
                  className="group flex items-center gap-4 rounded-lg border border-line bg-surface/70 p-4 transition-colors hover:border-line-strong hover:bg-surface-2/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="truncate font-medium tracking-tight">{lb.name}</span>
                      {lb.status === 'active' ? (
                        <Badge tone="live">
                          <LiveDot />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge>Terminado</Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-fg-subtle">
                      {host}/{lb.slug} · desde {shortDate(lb.starts_at)}
                      {remaining && remaining !== 'terminado' ? ` · termina em ${remaining}` : ''}
                    </p>
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-fg-subtle transition-colors group-hover:text-fg"
                    strokeWidth={2}
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
