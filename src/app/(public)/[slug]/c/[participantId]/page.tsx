import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { Stat, StatGrid } from '@/components/ui/stat'
import { Tabs, type TabItem } from '@/components/leaderboard/tabs'
import { VideoCard } from '@/components/leaderboard/video-card'
import { getClippers, getLeaderboardBySlug, getVideos, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { ALL_TIME, availablePeriods, periodLabel, periodTitle } from '@/lib/period'
import { compactNumber, fullNumber } from '@/lib/format'

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string; participantId: string }>
  searchParams: Promise<{ periodo?: string; ordem?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, participantId } = await params
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) return { title: 'Não encontrado' }

  const clippers = await getClippers(leaderboard.id, availablePeriods(leaderboard)[0])
  const clipper = clippers.find((c) => c.participantId === participantId)

  return { title: clipper ? `${clipper.displayName} · ${leaderboard.name}` : leaderboard.name,
    ...(isDemoLeaderboard(leaderboard.id) ? { robots: { index: false, follow: false } } : {}) }
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default async function ClipperPage({ params, searchParams }: Props) {
  const { slug, participantId } = await params
  const { periodo, ordem } = await searchParams

  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) notFound()

  const periods = availablePeriods(leaderboard)
  const periodKey = periodo && periods.includes(periodo) ? periodo : periods[0]
  const order = ordem === 'data' ? 'date' : 'views'

  const clippers = await getClippers(leaderboard.id, periodKey)
  const clipper = clippers.find((c) => c.participantId === participantId)
  if (!clipper) notFound()

  const videos = await getVideos(leaderboard, {
    periodKey,
    participantId,
    limit: 60,
    orderBy: order,
  })

  const href = (next: { periodo?: string; ordem?: string }) => {
    const sp = new URLSearchParams()
    const p = next.periodo ?? periodKey
    const o = next.ordem ?? (order === 'date' ? 'data' : 'views')
    if (p !== periods[0]) sp.set('periodo', p)
    if (o !== 'views') sp.set('ordem', o)
    const qs = sp.toString()
    return `/${slug}/c/${participantId}${qs ? `?${qs}` : ''}`
  }

  const periodTabs: TabItem[] = periods.map((key) => ({
    key,
    label: key === ALL_TIME ? 'Histórico geral' : periodLabel(key),
    href: href({ periodo: key }),
  }))

  const orderTabs: TabItem[] = [
    { key: 'views', label: 'Mais views', href: href({ ordem: 'views' }) },
    { key: 'data', label: 'Mais recentes', href: href({ ordem: 'data' }) },
  ]

  const best = clippers.find((c) => c.participantId === participantId)?.bestVideoId
  const bestVideo = videos.find((v) => v.id === best)

  return (
    <div className="min-h-dvh pb-20">
      <Container className="pt-8">
        <Link
          href={`/${slug}?periodo=${encodeURIComponent(periodKey)}`}
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Voltar ao leaderboard
        </Link>
        {isDemoLeaderboard(leaderboard.id) && <p className="mt-3 text-xs text-fg-subtle">Perfil e métricas de demonstração.</p>}

        {/* ─── Identidade ──────────────────────────────────────────────── */}
        <header className="mt-7 flex flex-wrap items-center gap-5">
          <Avatar name={clipper.displayName} src={clipper.avatarUrl} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {clipper.displayName}
              </h1>
              {clipper.rank ? (
                <Badge tone={clipper.rank <= 3 ? 'warning' : 'neutral'}>
                  {MEDALS[clipper.rank] ?? ''} {clipper.rank}.º lugar
                </Badge>
              ) : null}
              {clipper.status === 'disqualified' && <Badge>Desqualificado</Badge>}
            </div>

            {clipper.username && !isDemoLeaderboard(leaderboard.id) && (
              <a
                href={clipper.profileUrl ?? `https://www.tiktok.com/@${clipper.username}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
              >
                @{clipper.username}
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </a>
            )}
            <p className="mt-1 text-xs text-fg-subtle">{periodTitle(periodKey)}</p>
          </div>
        </header>

        {/* ─── Números ─────────────────────────────────────────────────── */}
        <section className="mt-9 rounded-xl border border-line bg-surface/50 p-6 sm:p-7">
          <StatGrid>
            <Stat label="Total views" value={compactNumber(clipper.totalViews)} />
            <Stat label="Clips" value={fullNumber(clipper.videoCount)} />
            <Stat label="Média" value={compactNumber(clipper.avgViews)} />
            <Stat
              label="Melhor clip"
              value={bestVideo ? compactNumber(bestVideo.latest_views) : '—'}
            />
          </StatGrid>
        </section>

        {/* ─── Clips ───────────────────────────────────────────────────── */}
        <section className="mt-12">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Clips</h2>
            <div className="flex flex-wrap gap-2">
              <Tabs items={periodTabs} active={periodKey} />
              <Tabs items={orderTabs} active={order === 'date' ? 'data' : 'views'} />
            </div>
          </div>

          {videos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-surface/40 px-6 py-14 text-center">
              <p className="text-sm text-fg-muted">
                Ainda não há clips deste clipper neste período.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {videos.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  highlight={order === 'views' && index === 0}
                  showClipper={false}
                />
              ))}
            </div>
          )}
        </section>
      </Container>
    </div>
  )
}
