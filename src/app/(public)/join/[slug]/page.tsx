import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Music2, ShieldCheck } from 'lucide-react'
import { BackdropWordmark } from '@/components/marketing/backdrop-wordmark'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getCreatorOf, getLeaderboardBySlug, getLeaderboardTotals, getRewards, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { currentPeriodKey } from '@/lib/period'
import { compactNumber, money, timeRemaining } from '@/lib/format'
import { isMockMode, tiktokConnectionAvailable } from '@/lib/providers/registry'

export const revalidate = 120

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) return { title: 'Convite não encontrado' }
  const creator = await getCreatorOf(leaderboard)
  return {
    title: `Participar · ${leaderboard.name}`,
    description: `Junta-te ao leaderboard de clippers ${creator ? `de ${creator.name}` : ''}.`,
  }
}

const ERRORS: Record<string, string> = {
  indisponivel: 'A ligação ao TikTok ainda não está disponível. Tenta mais tarde.',
  cancelado: 'Cancelaste a ligação. Podes tentar outra vez quando quiseres.',
  estado: 'O link expirou. Abre o convite outra vez.',
  tiktok: 'O TikTok não devolveu os dados. Tenta novamente daqui a pouco.',
  fechado: 'Esta competição já terminou.',
}

export default async function JoinPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { erro } = await searchParams

  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) notFound()

  const [creator, totals, rewards] = await Promise.all([
    getCreatorOf(leaderboard),
    getLeaderboardTotals(leaderboard.id, currentPeriodKey(leaderboard)),
    getRewards(leaderboard.id),
  ])

  const demo = isDemoLeaderboard(leaderboard.id)
  const available = !demo && tiktokConnectionAvailable()
  const mock = !demo && isMockMode()
  const closed = leaderboard.status !== 'active' || Boolean(leaderboard.ends_at && new Date(leaderboard.ends_at).getTime() <= Date.now())
  const remaining = timeRemaining(leaderboard.ends_at)

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <BackdropWordmark size="sm" />

      <main className="relative w-full max-w-[400px] text-center">
        <Avatar
          name={creator?.name ?? leaderboard.name}
          src={creator?.avatar_url ?? leaderboard.cover_url}
          size="xl"
          className="mx-auto ring-1 ring-accent/30 ring-offset-4 ring-offset-canvas"
        />

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance">
          Junta-te ao leaderboard de clippers
          {creator ? (
            <>
              {' '}
              de {creator.name}
            </>
          ) : null}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">{leaderboard.name}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Badge>{totals.active_clippers} clippers</Badge>
          <Badge>{compactNumber(totals.total_views)} views</Badge>
          {remaining && remaining !== 'terminado' ? <Badge>termina em {remaining}</Badge> : null}
        </div>

        {erro && ERRORS[erro] && (
          <p className="mt-6 rounded-sm border border-danger/25 bg-danger/8 px-4 py-3 text-sm text-danger">
            {ERRORS[erro]}
          </p>
        )}

        {isDemoLeaderboard(leaderboard.id) ? (
          <p className="mt-8 rounded-sm border border-line p-5 text-sm text-fg-muted">
            Competição de demonstração. A participação estará disponível quando o streamer ligar a sua conta.
          </p>
        ) : closed ? (
          <div className="mt-8 rounded-lg border border-line bg-surface/70 p-5">
            <p className="text-sm text-fg-muted">
              Esta competição já terminou. Vê como ficou o ranking final.
            </p>
            <Link
              href={`/${slug}`}
              className="mt-4 inline-block text-sm text-accent underline underline-offset-4 transition-colors hover:text-brand-bright"
            >
              Ver leaderboard →
            </Link>
          </div>
        ) : !available ? (
          <p className="mt-8 rounded-lg border border-line p-5 text-sm text-fg-muted">O streamer ainda está a preparar a ligação ao TikTok. Volta mais tarde para participar.</p>
        ) : (
          <>
            <a
              href={`/api/auth/tiktok/start?lb=${encodeURIComponent(slug)}`}
              className="mt-8 flex h-14 w-full items-center justify-center gap-2.5 rounded-sm bg-accent text-base font-medium text-canvas transition-colors duration-150 hover:bg-brand-bright"
            >
              <Music2 className="h-5 w-5" strokeWidth={2} />
              {mock ? 'Experimentar com conta de teste' : 'Conectar TikTok'}
            </a>
            {mock && <p className="mt-3 text-sm text-gold">Demonstração: cria uma conta simulada. Não liga o teu TikTok real.</p>}
            <Link href={`/join/${slug}/conta`} className="mt-4 inline-block text-sm underline">A minha participação</Link>

            <div className="mt-5 flex items-start gap-2.5 text-left">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle"
                strokeWidth={1.8}
              />
              <p className="text-xs leading-relaxed text-fg-subtle">
                Lemos apenas a lista pública dos teus vídeos e as respetivas métricas, através
                da API oficial do TikTok. Nunca publicamos nada em teu nome e podes desligar
                quando quiseres.{' '}
                <Link
                  href="/legal/privacidade"
                  className="underline underline-offset-2 hover:text-fg-muted"
                >
                  Privacidade
                </Link>
              </p>
            </div>
          </>
        )}

        {rewards.length > 0 && (
          <div className="mt-8 rounded-lg border border-line bg-surface/60 p-4">
            <p className="text-[11px] tracking-[0.08em] text-fg-subtle uppercase">Prémios</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {rewards.slice(0, 3).map((reward) => (
                <li key={reward.id} className="flex items-baseline justify-between gap-3">
                  <span className="nums text-fg-subtle">{reward.position}.º</span>
                  <span className="min-w-0 flex-1 truncate text-left text-fg-muted">
                    {reward.label ?? ''}
                  </span>
                  {reward.amount_cents != null && (
                    <span className="nums font-semibold text-fg">
                      {money(reward.amount_cents, reward.currency ?? 'EUR')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href={`/${slug}`}
          className="mt-8 inline-block text-sm text-fg-muted transition-colors hover:text-fg"
        >
          Ver o leaderboard
        </Link>
      </main>
    </div>
  )
}
