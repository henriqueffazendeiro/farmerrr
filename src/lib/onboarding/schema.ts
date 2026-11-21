import { z } from 'zod'
import { MAX_REWARD_POSITIONS } from '@/lib/leaderboards/reward-positions'

export const onboardingSchema = z.object({
  period: z.enum(['monthly', 'fixed']),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).nullable(),
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
}).superRefine((value, ctx) => {
  if (value.period === 'fixed' && (!value.endsAt || Date.parse(value.endsAt) <= Date.parse(value.startsAt))) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Escolhe uma data de fim posterior ao início.' })
  }
  if (value.period === 'monthly' && value.endsAt !== null) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'O período mensal não precisa de data de fim.' })
  }
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
