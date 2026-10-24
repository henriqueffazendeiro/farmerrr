import type { Creator, Leaderboard, Reward } from '@/lib/db/types'
import type { ClipperRow, VideoRow } from '@/lib/db/board'
import { ALL_TIME, currentPeriodKey } from '@/lib/period'

export const DEMO_SLUG = 'luisferreira'
export const DEMO_ID = 'demo-luisferreira'

export function demoLeaderboard(): Leaderboard {
  const key = currentPeriodKey({ period_mode: 'monthly', timezone: 'Europe/Lisbon' })
  const [year, month] = key.split('-').map(Number)
  return {
    id: DEMO_ID, creator_id: DEMO_ID, slug: DEMO_SLUG,
    name: 'Batalha de Clippers', description: 'Os melhores momentos da stream. A próxima conquista é tua.',
    announcement: 'A corrida está aberta. Publica os teus melhores clips e conquista o teu lugar no ranking.',
    quote: 'No fim do mês, os melhores clips merecem palco. Quero ver os vossos cortes, descobrir novos talentos e premiar quem faz a diferença.',
    quote_author: 'Mensagem de exemplo',
    rules: 'Publica clips originais das streams de Luís Ferreira.\nApenas vídeos públicos no TikTok contam para a classificação.\nO ranking mensal considera os vídeos publicados durante o mês em curso.\nViews compradas, conteúdo duplicado e vídeos fora do tema podem levar à desqualificação.\nOs resultados e prémios são confirmados pelo streamer no final da competição.',
    cover_url: null, starts_at: new Date(Date.UTC(year, month - 3, 1)).toISOString(),
    ends_at: null, event_at: new Date(Date.UTC(year, month, 0, 20)).toISOString(),
    timezone: 'Europe/Lisbon', status: 'active', period_mode: 'monthly', platforms: ['tiktok'],
    required_keyword: null, is_public: true,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

export function demoCreator(): Creator {
  return { id: DEMO_ID, owner_id: DEMO_ID, name: 'Luís Ferreira', handle: DEMO_SLUG,
    avatar_url: '/leaderboard/streamer.jpg', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
}

const participants = [
  ['Clips do Luís', 'clipsdoluis', 841920, 32, 48210, 4260, 2],
  ['Ferreirinha Clips', 'ferreirinhaclips', 627480, 41, 32160, 2180, 1],
  ['Luís sem filtro', 'luissemfiltro', 482350, 26, 28450, 1840, 3],
  ['Daily Ferreira', 'dailyferreira', 364820, 38, 19200, 1520, 4],
  ['Os cortes do Luís', 'oscortesdoluis', 298610, 19, 15840, 960, 5],
  ['Ferreira Moments', 'ferreiramoments', 246900, 11, 14210, 1270, 6],
  ['Luís Highlights', 'luishighlights', 182430, 23, 9240, 720, 7],
  ['Só mais um clip', 'somaisumclip', 147820, 16, 8310, 540, 8],
  ['Clips da comunidade', 'clipsdacomunidade', 98460, 12, 5410, 380, 4],
  ['Ferreira On Repeat', 'ferreiraonrepeat', 72930, 8, 4120, 260, 3],
  ['Cortes da live', 'cortesdalive', 51240, 7, 2870, 180, 6],
  ['Luís em 60 segundos', 'luisem60segundos', 36810, 9, 1950, 120, 5],
] as const

export function demoClippers(periodKey: string): ClipperRow[] {
  return participants.map(([name, username, views, clips, likes, followers, avatar], index) => {
    const multiplier = periodKey === ALL_TIME ? 3 + (index % 3) : 1
    return {
      participantId: `clipper-${index + 1}`, clipperProfileId: `profile-${index + 1}`,
      displayName: name, username, avatarUrl: `/leaderboard/avatar-${avatar}.jpg`,
      profileUrl: null, followerCount: followers, status: 'active' as const,
      joinedAt: demoLeaderboard().starts_at, needsReauth: false,
      totalViews: views * multiplier, totalLikes: likes * multiplier,
      videoCount: clips * multiplier, avgViews: Math.round(views / clips),
      rank: index + 1, previousRank: index === 0 ? 2 : index === 1 ? 1 : index + 1,
      bestVideoId: `demo-clip-${index + 1}`,
    }
  }).sort((a, b) => b.totalViews - a.totalViews).map((clipper, index) => ({ ...clipper, rank: index + 1, previousRank: periodKey === ALL_TIME ? null : clipper.previousRank }))
}

export function demoRewards(): Reward[] {
  return [50000, 25000, 10000].map((amount, index) => ({
    id: `reward-${index}`, leaderboard_id: DEMO_ID, position: index + 1,
    label: ['Vencedor do mês', 'Segundo lugar', 'Terceiro lugar'][index],
    amount_cents: amount, currency: 'EUR', created_at: '2026-01-01T00:00:00Z',
  }))
}

export function demoVideos(periodKey: string): VideoRow[] {
  const lb = demoLeaderboard()
  const clippers = demoClippers(periodKey)
  const currentKey = currentPeriodKey(lb)
  const titles = ['O chat não estava preparado para isto', 'Há momentos que só acontecem nesta stream', 'A reação diz tudo', 'Mais um dia normal com o Luís', 'Este momento merecia um clip', 'O melhor ficou para o fim']
  return Array.from({ length: periodKey === ALL_TIME ? 24 : 12 }, (_, i): VideoRow => {
    const clipper = clippers[i % clippers.length]
    const views = Math.round(clipper.totalViews * 0.28)
    const published = i >= 12 ? lb.starts_at : `${currentKey}-01T12:00:00Z`
    return {
      id: `demo-clip-${i + 1}`, social_account_id: clipper.clipperProfileId, provider: 'tiktok',
      provider_video_id: `demo-${i}`, url: null, embed_link: null,
      thumbnail_url: `/leaderboard/clip-${i % 6 + 1}.jpg`, caption: titles[i % 6],
      duration_seconds: 22 + i * 3, published_at: published,
      latest_views: views, latest_likes: Math.round(views * 0.048), latest_comments: 22 + i * 4,
      latest_shares: 100 + i * 8, metrics_updated_at: null, is_deleted: false,
      created_at: published, updated_at: published, participantId: clipper.participantId,
      clipperName: clipper.displayName, username: clipper.username, excluded: false,
    }
  }).sort((a, b) => b.latest_views - a.latest_views)
}
