export type LiveClip = {
  id: string
  liveDate: string
  title: string
  thumbnail: string | null
  author: string
  authorName: string
  avatar: string | null
  publishedAt: string
  views: number
  likes: number
  comments: number
  favorites?: number
  shares?: number
  url: string | null
}

export function topClipsForLive(clips: LiveClip[], liveDate: string, limit = 4): LiveClip[] {
  return clips.filter(clip => clip.liveDate === liveDate)
    .sort((a, b) => b.views - a.views || a.id.localeCompare(b.id))
    .slice(0, limit)
}

// Explicit associations for the demo lives; not inferred from publication dates.
export function demoClipsForLive(liveDate: string): LiveClip[] {
  const titles = ['O chat não estava preparado para isto', 'Há momentos que só acontecem nesta stream',
    'A reação diz tudo', 'Mais um dia normal com o Luís', 'Este momento merecia um clip', 'O melhor ficou para o fim']
  const authors = ['clipsdoluis', 'ferreirinhaclips', 'luissemfiltro', 'dailyferreira', 'oscortesdoluis', 'ferreiramoments']
  const names = ['Clips do Luís', 'Ferreirinha Clips', 'Luís sem filtro', 'Daily Ferreira', 'Os cortes do Luís', 'Ferreira Moments']
  const seed = Number(liveDate.replaceAll('-', ''))
  return Array.from({ length: 6 }, (_, index) => {
    const variant = (seed + index) % titles.length
    const views = 12000 + ((seed * (index + 3) * 7919) % 280000)
    return {
      id: `demo-${liveDate}-${index}`, liveDate,
      title: titles[variant], thumbnail: `/leaderboard/clip-${variant + 1}.jpg`,
      author: authors[variant], authorName: names[variant], avatar: `/leaderboard/avatar-${variant + 1}.jpg`,
      publishedAt: liveDate, views, likes: Math.round(views * 0.048), comments: 22 + ((seed + index * 17) % 90),
      favorites: Math.round(views * 0.006), shares: Math.round(views * 0.003), url: null,
    }
  })
}
