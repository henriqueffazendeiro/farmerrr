import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { StreamerLeaderboard } from '@/components/leaderboard/streamer-leaderboard'
import { getClippers, getCreatorOf, getLeaderboardBySlug, getLeaderboardTotals, getRewards, getVideos, isDemoLeaderboard } from '@/lib/leaderboards/public-data'
import { liveDateFromCaption, type LiveClip } from '@/components/lives/live-clips'
import { ALL_TIME, availablePeriods, currentPeriodEnd } from '@/lib/period'
import { getCreatorLives } from '@/lib/streams/data'
import { getCurrentUser } from '@/lib/supabase/server'
import { SettingsContent } from '@/components/dashboard/settings-content'
import { joinFormProps } from '@/components/leaderboard/join-content'
import { PageReady } from '@/components/dashboard/page-ready'
import { creatorHasAccess } from '@/lib/billing/stripe'
import { OwnerPausedOverlay, PausedPage } from '@/components/billing/paused'
import { duePrize, upcomingPrize } from '@/lib/prizes/payments'
import { ClipperSettingsView, clipperSettingsData } from '@/components/clipper/clipper-settings'
import { prizeNotices } from '@/components/prizes/clipper-prizes'
import { streamerPrizeNotices } from '@/components/prizes/streamer-prizes'
import { withdrawPrizesAction } from '@/lib/prizes/actions'
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
  const leaderboard = await getLeaderboardBySlug(slug)
  if (!leaderboard) notFound()
  const periods = availablePeriods(leaderboard)
  const periodKey = ordem !== 'media' && periodo && periods.includes(periodo) ? periodo : periods[0]
  const demo = isDemoLeaderboard(leaderboard.id)
  const creatorPromise = getCreatorOf(leaderboard)
  const userPromise = demo ? Promise.resolve(null) : getCurrentUser()
  // As definições começam a carregar assim que se sabe que é o dono,
  // em vez de esperarem pelo resto dos dados da página.
  // Dono de volta de uma entrega: se correu bem, basta o retângulo desaparecer (ou passar a "Pagamento em processamento").
  // Se houve um problema (erro, pagamento repetido…), as definições abrem com o aviso nos Prémios.
  const ownerNotice = premios && !['pago', 'entregue', 'processando'].includes(premios) && streamerPrizeNotices[premios] ? premios : undefined
  const settingsPromise = Promise.all([creatorPromise, userPromise]).then(([creator, user]) =>
    user && creator && user.id === creator.owner_id ? SettingsContent({ id: leaderboard.id, premios: ownerNotice }) : undefined)
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
  const [creator, datasets, rewards, baseLives, settingsContent, videos, access, [prizeDue, prizeNext], clipperData] = await Promise.all([
    creatorPromise, datasetsPromise, getRewards(leaderboard),
    demo ? Promise.resolve([]) : getCreatorLives(leaderboard.creator_id, leaderboard.timezone),
    settingsPromise, videosPromise, accessPromise, prizePromise, clipperPromise,
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
  // Clipper de volta de um levantamento: "enviado" abre o pop-up de parabéns; os outros avisos abrem as definições.
  const withdrawn = clipperData && premios === 'enviado'
  const withdrawnCents = Number(valor)
  const clipperNotice = clipperData && premios && premios !== 'enviado' && prizeNotices[premios] ? premios : undefined
  // Vencedor com prémio pago pelo site e ainda por levantar: pop-up com o botão "Levantar" (até levantar ou fechar).
  // Só os prémios desta competição (os ganhos de cada streamer nunca se misturam).
  const available = (clipperData?.prizes ?? []).filter(prize => prize.status === 'available')
  const availableCents = available.reduce((sum, prize) => sum + prize.amount_cents, 0)
  const showPrizeReady = availableCents > 0 && !premios && entrou !== '1'
  return <>{!access && <OwnerPausedOverlay slug={leaderboard.slug} />}<StreamerLeaderboard leaderboard={leaderboard} creator={creator} datasets={datasets} join={joinFormProps(leaderboard)}
    isOwner={isOwner} settingsContent={settingsContent} prizeDue={prizeDue} prizeNext={prizeNext} clockTarget={currentPeriodEnd(leaderboard)}
    clipperSettings={clipperData ? <ClipperSettingsView data={clipperData} premios={clipperNotice} /> : undefined}
    settingsOpen={clipperNotice != null || (isOwner && ownerNotice != null)}
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
    {showPrizeReady && <PageReady param={[]} title="Prémio disponível" celebration="money"
      image="https://cdn.7tv.app/emote/01JV0DYKQZ8F4FJ7GPMM8RJP35/4x.gif"
      description={`Parabéns! ${money(availableCents)} prontos a levantar para o IBAN.`}
      action={`Levantar ${money(availableCents)}`}
      submit={{ action: withdrawPrizesAction, fields: { slug: leaderboard.slug }, pendingLabel: 'A abrir…' }}
      dismissKey={`prize-ready:${available.map(prize => prize.id).sort().join(',')}`} />}
  </>
}
