import { notFound } from 'next/navigation'
import { getLeaderboardBySlug, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { getRecaps } from '@/lib/recap/data'
import { summarizeRecap } from '@/lib/recap/model'
import { FilmPlayer } from '@/components/recap/film-player'
import { periodLabel } from '@/lib/period'

export const dynamic = 'force-dynamic'
export default async function FilmPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { slug } = await params, { mes } = await searchParams
  const lb = await getLeaderboardBySlug(slug)
  if (!lb || !lb.is_public || lb.status === 'draft') notFound()
  const recaps = await getRecaps(lb)
  const recap = mes ? recaps.find(r => r.period_key === mes) : recaps[0]
  if (!recap || !recap.snapshot.videos.length) return <main style={{ padding: 60 }}>Ainda não há momentos para este filme. <a href={`/${slug}/recap`}>Voltar</a></main>
  const summary = summarizeRecap(recap.snapshot)
  return <FilmPlayer slug={slug} demo={isDemoLeaderboard(lb.id)} data={{
    edition: `${periodLabel(recap.period_key)} ${recap.period_key.slice(0, 4)}`.toUpperCase(), community: slug.toUpperCase(),
    clips: summary.totals.clips, views: summary.totals.views, shares: summary.totals.shares, people: summary.ranking.length,
    bestViews: summary.mostViewed?.views ?? 0, bestImage: summary.mostViewed?.thumbnail ?? null,
    bestName: summary.mostViewed?.caption ?? '', winner: summary.winner?.name ?? 'A comunidade',
    images: [...new Set(recap.snapshot.videos.map(v => v.thumbnail).filter((v): v is string => Boolean(v)))].slice(0, 9),
  }} />
}
