import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { ButtonLink } from '@/components/ui/button'
import { Stat, StatGrid } from '@/components/ui/stat'
import { getClippers, getLeaderboardBySlug } from '@/lib/db/board'
import { currentPeriodKey } from '@/lib/period'
import { compactNumber } from '@/lib/format'
import { redirect } from 'next/navigation'
import { getClipperMembership } from '@/lib/clippers/session'
import { AutoRefresh } from '@/components/leaderboard/auto-refresh'
import { isMockMode } from '@/lib/providers/registry'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Estás dentro', robots: { index: false } }

export default async function JoinSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ p?: string }>
}) {
  const { slug } = await params
  const { p: participantId } = await searchParams
  const member = await getClipperMembership(slug)
  if (!member || (participantId && participantId !== member.participant.id)) redirect(`/join/${encodeURIComponent(slug)}`)

  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) notFound()

  const clippers = await getClippers(leaderboard.id, currentPeriodKey(leaderboard))
  const me = clippers.find((c) => c.participantId === member.participant.id)

  return (
    <div className="relative grid min-h-dvh place-items-center px-5 py-10">
      <main className="w-full max-w-[400px] text-center">
        <AutoRefresh seconds={30} />
        {isMockMode() && <p className="mb-5 text-sm text-gold">Conta de demonstração — dados simulados.</p>}
        <CheckCircle2 className="mx-auto h-10 w-10 text-accent" strokeWidth={1.6} />

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          {me?.username ? (
            <>
              Estás dentro, <span className="text-accent">@{me.username}</span>
            </>
          ) : (
            'Estás dentro'
          )}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">{leaderboard.name}</p>

        {me && (
          <div className="mt-8 rounded-xl border border-line bg-surface/70 p-6">
            <Avatar
              name={me.displayName}
              src={me.avatarUrl}
              size="lg"
              className="mx-auto"
            />
            <div className="mt-6">
              <StatGrid>
                <Stat label="Views" value={compactNumber(me.totalViews)} />
                <Stat label="Clips" value={String(me.videoCount)} />
                <Stat label="Média" value={compactNumber(me.avgViews)} />
                <Stat label="Posição" value={me.rank ? `#${me.rank}` : '—'} />
              </StatGrid>
            </div>
          </div>
        )}

        {!member.account?.last_synced_at && <p className="mt-5 text-sm text-fg-muted">A tua participação está criada. Estamos a aguardar a primeira importação dos vídeos; esta página atualiza automaticamente.</p>}
        {member.account?.last_synced_at && me && me.videoCount === 0 && (
          <p className="mt-5 text-sm leading-relaxed text-fg-muted">
            Ainda não encontrámos clips teus dentro do período da competição. Os próximos
            vídeos que publicares entram automaticamente — não tens de fazer mais nada.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <ButtonLink href={`/join/${slug}/conta`} variant="secondary">Gerir a minha participação</ButtonLink>
          <ButtonLink href={`/${slug}`} size="lg">
            Ver o leaderboard
          </ButtonLink>
          {me && (
            <Link
              href={`/${slug}/c/${me.participantId}`}
              className="text-sm text-fg-muted transition-colors hover:text-fg"
            >
              Ver a minha página
            </Link>
          )}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-fg-subtle">
          A partir de agora acompanhamos os teus clips automaticamente. Podes desligar a
          ligação nas definições do TikTok quando quiseres.
        </p>
      </main>
    </div>
  )
}
