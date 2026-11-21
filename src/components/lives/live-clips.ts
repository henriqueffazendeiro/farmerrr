export type LiveClip = {
  providerVideoId?: string
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

/**
 * Dia da live a que o clip pertence, lido da descrição: `#20/11` (também `#20-11`, `#20.11`, `#20_11`).
 * O ano é o da publicação; se esse dia ainda estiver no futuro, é do ano anterior.
 * `publishedOn` é a data local de publicação (AAAA-MM-DD). Devolve '' se não houver data válida.
 */
export function liveDateFromCaption(caption: string | null | undefined, publishedOn: string): string {
  const match = caption?.match(/#(\d{1,2})[/\-._](\d{1,2})(?!\d)/)
  if (!match) return ''
  const day = Number(match[1]), month = Number(match[2])
  if (month < 1 || month > 12 || day < 1) return ''
  let year = Number(publishedOn.slice(0, 4))
  const iso = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (iso(year) > publishedOn) year -= 1
  if (day > new Date(year, month, 0).getDate()) return ''
  return iso(year)
}

/** Bónus na nota da live pelos clips associados: cresce cada vez mais devagar, no máximo +1,0 (15 clips). */
export const clipBonus = (count: number) => Math.min(1, Math.log2(1 + Math.max(0, count)) / 4)

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
