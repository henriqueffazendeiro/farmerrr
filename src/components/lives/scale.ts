import { demoClipsForLive, type LiveClip } from './live-clips'

export const SCALE = [
  { min: 9.5, label: 'Lendária', bg: '#1DA1F2', fg: '#FFFFFF' },
  { min: 9, label: 'Épica', bg: '#186A3B', fg: '#FFFFFF' },
  { min: 8, label: 'Muito boa', bg: '#28B463', fg: '#111111' },
  { min: 7, label: 'Boa', bg: '#F4D03F', fg: '#111111' },
  { min: 6, label: 'Média', bg: '#F39C12', fg: '#111111' },
  { min: 4, label: 'Fraca', bg: '#E74C3C', fg: '#FFFFFF' },
  { min: 0, label: 'Péssima', bg: '#633974', fg: '#FFFFFF' },
] as const

export const scaleFor = (score: number) => SCALE.find(level => score >= level.min) ?? SCALE[SCALE.length - 1]
export const formatScore = (score: number) => score.toFixed(1).replace('.', ',')
export const formatCount = (count: number) => new Intl.NumberFormat('pt-PT', { useGrouping: true }).format(count)
export const dayAt = (week: number, row: number) => week * 7 + row + 1
export const dateOf = (date: string) => new Date(`${date}T12:00:00`)

export type Live = {
  id?: string
  isLive?: boolean
  platform?: 'twitch' | 'youtube' | 'kick'
  date: string
  title: string
  average: number
  count: number
  open: boolean
  thumbnail: string | null
  vod: string | null
  clips?: LiveClip[]
}

// Fixture restricted to the existing demonstration page; these are not real ratings.
export function demoLives(): Live[] {
  const titles = ['A noite do apagão', 'Reagir aos vossos clips', 'Torneio de FIFA com a malta', 'Speedrun até às 4 da manhã',
    'Q&A sem filtros', 'Primeira vez em Elden Ring', 'Maratona de GTA RP', 'Dia de desafios da chat', 'Unboxing do setup novo',
    'Rage quit histórico', 'Live de análise dos clippers', 'Karaoke na stream', 'Just chatting com convidado', 'Viagem ao Minecraft hardcore',
    'Tentar ganhar 10 seguidas', 'A live mais caótica do mês', 'Jogos de terror às escuras', 'Especial 100k seguidores', 'Receitas com a chat',
    'Ranked até ao Diamante', 'Duo com o Miguel', 'Stream de domingo calmo', 'Resposta às polémicas', 'Noite de Among Us']
  const lives: Live[] = []
  for (let month = 7; month <= 9; month++) {
    for (let day = 1; day <= (month === 9 ? 17 : 31); day++) {
      const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      let seed = 2166136261
      for (const char of date) { seed ^= char.charCodeAt(0); seed = Math.imul(seed, 16777619) }
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
      if (random() < 0.16) continue
      let average = 8.3 + (random() + random() + random() - 1.5) * 1.3
      if (date === '2026-09-06') average = 6.2
      if (date === '2026-08-21') average = 4.8
      lives.push({ date, title: titles[Math.floor(random() * titles.length)],
        average: Math.round(Math.max(3.6, Math.min(9.9, average)) * 10) / 10,
        count: Math.floor(180 + random() * 1600), open: date >= '2026-08-28', thumbnail: null, vod: null,
        clips: demoClipsForLive(date) })
    }
  }
  return lives
}

export function withVote(live: Live, vote?: number): Live {
  return vote ? { ...live, average: Math.round((live.average * live.count + vote) / (live.count + 1) * 10) / 10, count: live.count + 1 } : live
}
