import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { StreamerLeaderboard } from '@/components/leaderboard/streamer-leaderboard'
import { getClippers, getCreatorOf, getLeaderboardBySlug, getLeaderboardTotals, getRewards, getVideos, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { liveDateFromCaption, type LiveClip } from '@/components/lives/live-clips'
import { ALL_TIME, availablePeriods } from '@/lib/period'
import { getCreatorLives } from '@/lib/streams/data'
import { getCurrentUser } from '@/lib/supabase/server'
import { SettingsContent } from '@/components/dashboard/settings-content'
import { joinFormProps } from '@/components/leaderboard/join-content'
import { PageReady } from '@/components/dashboard/page-ready'
import { creatorHasAccess } from '@/lib/billing/stripe'
import { OwnerPausedOverlay, PausedPage } from '@/components/billing/paused'

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ periodo?: string; ordem?: string; criada?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const lb = await getLeaderboardBySlug(slug)
  if (!lb) return { title: 'Ranking não encontrado' }
  return { title: lb.name, description: lb.description,
    ...(isDemoLeaderboard(lb.id) ? { robots: { index: false, follow: false } } : {}) }
}

export default async function PublicLeaderboardPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { periodo, ordem, criada } = await searchParams
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) notFound()
  const periods = availablePeriods(leaderboard)
  const periodKey = ordem !== 'media' && periodo && periods.includes(periodo) ? periodo : periods[0]
  const demo = isDemoLeaderboard(leaderboard.id)
  const creatorPromise = getCreatorOf(leaderboard)
  const userPromise = demo ? Promise.resolve(null) : getCurrentUser()
  // As definições começam a carregar assim que se sabe que é o dono,
  // em vez de esperarem pelo resto dos dados da página.
  const settingsPromise = Promise.all([creatorPromise, userPromise]).then(([creator, user]) =>
    user && creator && user.id === creator.owner_id ? SettingsContent({ id: leaderboard.id }) : undefined)
  // Carrega todos os períodos (no máximo 2: mês atual e "de sempre") em paralelo,
  // para o cliente trocar de separador sem voltar ao servidor.
  const datasetsPromise = Promise.all(periods.map(async period => {
    const [rows, periodTotals] = await Promise.all([getClippers(leaderboard.id, period), getLeaderboardTotals(leaderboard.id, period)])
    return [period, { clippers: rows.filter(c => c.status === 'active'), totals: periodTotals }] as const
  })).then(entries => Object.fromEntries(entries))
  // Clips reais para o mural: os mais vistos de cada período (sem repetidos).
  // O histórico vem mais completo (até 1000) para contar os clips de cada live pela data na descrição (#20/11).
  const videosPromise = demo ? Promise.resolve({ wall: [], all: [] }) : Promise.all(periods.map(period =>
    getVideos(leaderboard, { periodKey: period, limit: period === ALL_TIME ? 1000 : 60, orderBy: 'views' })))
    .then(lists => {
      const all = [...new Map(lists.flat().map(video => [video.id, video])).values()]
      const wall = new Set(lists.flatMap(list => list.slice(0, 60)).map(video => video.id))
      return { wall: all.filter(video => wall.has(video.id)), all }
    })
  const accessPromise = demo ? Promise.resolve(true) : creatorHasAccess(leaderboard.creator_id)
  const [creator, datasets, rewards, baseLives, settingsContent, videos, access] = await Promise.all([
    creatorPromise, datasetsPromise, getRewards(leaderboard),
    demo ? Promise.resolve([]) : getCreatorLives(leaderboard.creator_id, leaderboard.timezone),
    settingsPromise, videosPromise, accessPromise,
  ])
  const isOwner = settingsContent !== undefined
  // Sem subscrição ativa: os visitantes veem "em pausa"; o dono vê a página com um aviso.
  if (!access && !isOwner) return <PausedPage name={leaderboard.name} />
  const { clippers, totals } = datasets[periodKey]
  const avatars = new Map(Object.values(datasets).flatMap(set => set.clippers).map(row => [row.participantId, row.avatarUrl]))
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: leaderboard.timezone || 'Europe/Lisbon' })
  const toClip = (video: typeof videos.all[number]): LiveClip => {
    const publishedAt = localDate.format(new Date(video.published_at))
    return {
      providerVideoId: video.provider_video_id,
      id: video.id, liveDate: liveDateFromCaption(video.caption, publishedAt), title: video.caption ?? 'Clip sem título', thumbnail: video.thumbnail_url,
      author: video.username ?? '', authorName: video.clipperName,
      avatar: video.participantId ? avatars.get(video.participantId) ?? null : null,
      publishedAt,
      views: video.latest_views, likes: video.latest_likes, comments: video.latest_comments, shares: video.latest_shares, url: video.url,
    }
  }
  const clips = videos.wall.map(toClip)
  // Cada live fica com os clips que têm o dia dela na descrição; o número de clips dá bónus na nota.
  const byLiveDate = new Map<string, LiveClip[]>()
  for (const clip of videos.all.map(toClip)) {
    if (clip.liveDate) byLiveDate.set(clip.liveDate, [...byLiveDate.get(clip.liveDate) ?? [], clip])
  }
  const lives = baseLives.map(live => {
    const tagged = byLiveDate.get(live.date) ?? []
    return { ...live, clips: tagged.slice(0, 24), clipCount: tagged.length }
  })
  return <>{!access && <OwnerPausedOverlay slug={leaderboard.slug} />}<StreamerLeaderboard leaderboard={leaderboard} creator={creator} datasets={datasets} join={joinFormProps(leaderboard)}
    isOwner={isOwner} settingsContent={settingsContent}
    clippers={clippers} totals={totals} rewards={rewards}
    periods={periods} periodKey={periodKey}
    sort={ordem === 'media' ? 'media' : 'views'} demo={isDemoLeaderboard(leaderboard.id)} lives={lives} clips={clips} isLive={lives.some(live => live.isLive)} />
    {isOwner && criada === '1' && <PageReady />}
  </>
}
