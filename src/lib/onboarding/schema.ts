import { z } from 'zod'
import { MAX_REWARD_POSITIONS } from '@/lib/leaderboards/reward-positions'

export const onboardingSchema = z.object({
  // Só há competições mensais automáticas (do dia 1 ao último dia de cada mês). `.catch`: pagamentos antigos ainda em curso.
  period: z.literal('monthly').catch('monthly'),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.null().catch(null),
  timezone: z.string().refine(value => {
    try { new Intl.DateTimeFormat('pt-PT', { timeZone: value }); return true } catch { return false }
  }, 'Fuso horário inválido.'),
  platform: z.enum(['youtube', 'twitch', 'kick']),
  channel: z.string().trim().min(1, 'Indica a tua conta.').max(200),
  rewards: z.array(z.object({
    position: z.number().int().min(1).max(MAX_REWARD_POSITIONS),
    amountCents: z.number().int().min(1).max(100000000),
  })).max(MAX_REWARD_POSITIONS).refine(rewards => new Set(rewards.map(reward => reward.position)).size === rewards.length,
    'Cada lugar só pode ter um prémio.').default([]),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
