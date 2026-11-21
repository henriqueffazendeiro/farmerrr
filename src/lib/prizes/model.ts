import { ALL_TIME } from '@/lib/period'

/**
 * Comissão da plataforma, tirada à parte de cada clipper: o streamer paga exatamente os prémios (600 €),
 * um prémio de 300 € chega ao clipper como 285 €. A taxa do Stripe sai destes 5%.
 */
export const PLATFORM_FEE_RATE = 0.05
export const feeFor = (prizeCents: number) => Math.round(prizeCents * PLATFORM_FEE_RATE)
export const netOf = (prizeCents: number) => prizeCents - feeFor(prizeCents)

/** Prémios do último período fechado que o streamer ainda não entregou (o retângulo "Entregar prémios"). */
export type DueWinner = { position: number; name: string; username: string | null; discord?: string | null; avatarUrl: string | null; amountCents: number }
export type DuePrize = { periodKey: string; periodName: string; amountCents: number; winners: DueWinner[] }

export type PrizeShare = { position: number; amountCents: number; participantId: string; clipperProfileId: string }

/**
 * Parte de cada clipper: o prémio de cada posição vai para quem acabou nessa posição.
 * Posições sem clipper (menos participantes do que prémios) ficam de fora e não são cobradas.
 */
export function splitPrizes(
  rewards: { position: number; amount_cents: number | null }[],
  ranked: { rank: number | null; participantId: string; clipperProfileId: string }[],
): PrizeShare[] {
  const byRank = new Map(ranked.filter(row => row.rank != null).map(row => [row.rank!, row]))
  return rewards
    .filter(reward => (reward.amount_cents ?? 0) > 0)
    .sort((a, b) => a.position - b.position)
    .flatMap(reward => {
      const winner = byRank.get(reward.position)
      return winner ? [{ position: reward.position, amountCents: reward.amount_cents!, participantId: winner.participantId, clipperProfileId: winner.clipperProfileId }] : []
    })
}

/**
 * Períodos que já terminaram e por isso podem ser pagos:
 * mensal → meses anteriores ao atual; datas fixas → o período único, depois de a competição acabar.
 */
export function closedPeriods(
  lb: { period_mode: string; ends_at: string | null; status: string },
  periodKeys: string[], currentKey: string, now = Date.now(),
): string[] {
  const keys = [...new Set(periodKeys)]
  const ended = lb.status !== 'active' || (lb.ends_at != null && new Date(lb.ends_at).getTime() <= now)
  // Mensal: os meses passados; se a competição já acabou (data de fim), o mês atual também fecha.
  if (lb.period_mode === 'monthly') return keys.filter(key => /^\d{4}-\d{2}$/.test(key) && (key < currentKey || (ended && key === currentKey))).sort().reverse()
  return ended && keys.includes(ALL_TIME) ? [ALL_TIME] : []
}
