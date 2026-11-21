import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { StreamerLeaderboard } from '@/components/leaderboard/streamer-leaderboard'
import { getClippers, getCreatorOf, getLeaderboardBySlug, getLeaderboardTotals, getRewards, getVideos, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { liveDateFromCaption, type LiveClip } from '@/components/lives/live-clips'
import { ALL_TIME, availablePeriods, currentPeriodEnd, currentPeriodKey, isPaused, nextMonthlyDates, periodLabel } from '@/lib/period'
import { getLeaderboardBySlug as loadLeaderboard } from '@/lib/db/board'
import { getCreatorLives } from '@/lib/streams/data'
import { getCurrentUser } from '@/lib/supabase/server'
import { SettingsContent } from '@/components/dashboard/settings-content'
import { joinFormProps } from '@/components/leaderboard/join-content'
import { PageReady } from '@/components/dashboard/page-ready'
import { creatorHasAccess } from '@/lib/billing/stripe'
import { OwnerPausedOverlay, PausedPage } from '@/components/billing/paused'
import { advanceMonthlyDates, duePrize, pauseState, upcomingPrize } from '@/lib/prizes/payments'
import { ClipperSettingsView, clipperSettingsData } from '@/components/clipper/clipper-settings'
import { prizeNotices } from '@/components/prizes/clipper-prizes'
import { money } from '@/lib/format'

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ periodo?: string; ordem?: string; criada?: string; entrou?: string; premios?: string; valor?: string }>
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
  const { periodo, ordem, criada, entrou, premios, valor } = await searchParams
  const found = await getLeaderboardBySlug(slug)
  if (!found) notFound()
  // Mensal com datas: se a competição seguinte já pode começar (prémios entregues e chegou o dia), as datas avançam agora.
  const advanced = !isDemoLeaderboard(found.id) && await advanceMonthlyDates(found)
    .catch(error => { console.error('[monthly dates]', error instanceof Error ? error.message : error); return false })
  const leaderboard = (advanced && await loadLeaderboard(slug)) || found
  const periods = availablePeriods(leaderboard)
  const periodKey = ordem !== 'media' && periodo && periods.includes(periodo) ? periodo : periods[0]
  const demo = isDemoLeaderboard(leaderboard.id)
  const creatorPromise = getCreatorOf(leaderboard)
  const userPromise = demo ? Promise.resolve(null) : getCurrentUser()
  // As definições começam a carregar assim que se sabe que é o dono,
  // em vez de esperarem pelo resto dos dados da página.
  const settingsPromise = Promise.all([creatorPromise, userPromise]).then(([creator, user]) =>
    user && creator && user.id === creator.owner_id ? SettingsContent({ id: leaderboard.id }) : undefined)
  // Um clipper que já participa vê as suas definições em vez do "Participar".
  const clipperPromise = demo ? Promise.resolve(null) : settingsPromise.then(settings => settings !== undefined ? null
    : clipperSettingsData(slug).catch(error => { console.error('[clipper settings]', error instanceof Error ? error.message : error); return null }))
  // Só o dono vê o "Entregar prémios" quando o mês fecha.
  // Também os prémios do mês a decorrer, para o retângulo aparecer logo quando o contador chega a zero.
  const prizePromise = settingsPromise.then(settings => settings === undefined ? [null, null] as const
    : Promise.all([duePrize(leaderboard), upcomingPrize(leaderboard)])
      .catch(error => { console.error('[prize due]', error instanceof Error ? error.message : error); return [null, null] as const }))
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
  // Em pausa (acabou e ainda não começou a seguinte): o que mostrar no lugar do contador.
  const pausePromise = !demo && isPaused(leaderboard) ? pauseState(leaderboard)
    .catch(error => { console.error('[pause]', error instanceof Error ? error.message : error); return { delivered: false, hasPrizes: true } }) : Promise.resolve(null)
  const [creator, datasets, rewards, baseLives, settingsContent, videos, access, [prizeDue, prizeNext], clipperData, pause] = await Promise.all([
    creatorPromise, datasetsPromise, getRewards(leaderboard),
    demo ? Promise.resolve([]) : getCreatorLives(leaderboard.creator_id, leaderboard.timezone),
    settingsPromise, videosPromise, accessPromise, prizePromise, clipperPromise, pausePromise,
  ])
  const isOwner = settingsContent !== undefined
  const nextDates = pause && leaderboard.ends_at ? nextMonthlyDates({ timezone: leaderboard.timezone, starts_at: leaderboard.starts_at, ends_at: leaderboard.ends_at }) : null
  const nextStart = nextDates && nextDates.starts.getTime() > Date.now() ? nextDates.starts : null
  const waitingForPrizes = !!pause && pause.hasPrizes && !pause.delivered
  const pauseBanner = pause ? {
    eyebrow: `${periodLabel(currentPeriodKey(leaderboard))} terminou`,
    title: !pause.hasPrizes ? 'Competição em pausa' : isOwner && pause.delivered ? 'Prémios entregues' : 'A decorrer entrega de prémios',
    text: waitingForPrizes ? 'A próxima competição começa depois da entrega dos prémios.'
      : nextStart ? `A próxima competição começa a ${new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', timeZone: leaderboard.timezone || 'Europe/Lisbon' }).format(nextStart)}.`
      : 'A próxima competição está a começar.',
  } : null
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
  // Clipper de volta de um levantamento: "enviado" abre o pop-up de parabéns; os outros avisos abrem as definições.
  const withdrawn = clipperData && premios === 'enviado'
  const withdrawnCents = Number(valor)
  const clipperNotice = clipperData && premios && premios !== 'enviado' && prizeNotices[premios] ? premios : undefined
  return <>{!access && <OwnerPausedOverlay slug={leaderboard.slug} />}<StreamerLeaderboard leaderboard={leaderboard} creator={creator} datasets={datasets} join={joinFormProps(leaderboard)}
    isOwner={isOwner} settingsContent={settingsContent} prizeDue={prizeDue} prizeNext={prizeNext} clockTarget={currentPeriodEnd(leaderboard)}
    pause={pauseBanner} refreshAt={nextStart && !waitingForPrizes ? nextStart.toISOString() : null}
    clipperSettings={clipperData ? <ClipperSettingsView data={clipperData} premios={clipperNotice} /> : undefined}
    settingsOpen={clipperNotice != null}
    clippers={clippers} totals={totals} rewards={rewards}
    periods={periods} periodKey={periodKey}
    sort={ordem === 'media' ? 'media' : 'views'} demo={isDemoLeaderboard(leaderboard.id)} lives={lives} clips={clips} isLive={lives.some(live => live.isLive)} />
    {isOwner && criada === '1' && <PageReady />}
    {clipperData && entrou === '1' && <PageReady param="entrou" title="Inscrição feita"
      description="A conta do TikTok está ligada."
      action="Ver ranking" />}
    {withdrawn && <PageReady param={['premios', 'valor']} title="Prémio levantado" celebration="money"
      image="https://cdn.7tv.app/emote/01HRBKB9T000072EX513ZQ4552/4x.png"
      description={`Parabéns! ${Number.isFinite(withdrawnCents) && withdrawnCents > 0 ? money(withdrawnCents) : 'O prémio'} a caminho do IBAN. O dinheiro chega em poucos dias úteis.`}
      action="Fechar" />}
  </>
}
