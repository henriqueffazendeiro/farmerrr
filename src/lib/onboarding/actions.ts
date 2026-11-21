'use server'

import { getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeStreamChannel } from '@/lib/streams/public-input'
import { readPublicChannel } from '@/lib/streams/public-provider'
import { trackingRateKey } from '@/lib/auth/rate-key'
import { onboardingSchema, type OnboardingInput } from './schema'
import { billingConfigured, getSubscription, isActive } from '@/lib/billing/stripe'
import { checkoutUrl } from '@/lib/billing/checkout'
import { createOnboardingPage, encodeOnboarding, existingPageSlug } from './create'

/** `next`: o Checkout do Stripe (com a faturação ligada, a página só é criada depois do pagamento). */
export type OnboardingResult = { error?: string; slug?: string; notice?: string; next?: string }

export async function finishOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Inicia sessão para criar a tua página.' }
  const parsed = onboardingSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Confirma os dados.' }
  const values = parsed.data
  try {
    const url = normalizeStreamChannel(values.platform, values.channel)
    const { data: allowed, error: budgetError } = await createAdminClient().rpc('consume_public_tracking_attempt', { p_key: trackingRateKey(`onboarding:${user.id}`) })
    if (budgetError || !allowed) return { error: 'Não foi possível continuar agora. Tenta novamente mais tarde.' }
    const existing = await existingPageSlug(user.id)
    if (existing) return { slug: existing }
    // Valida o canal já (antes de pagar): um nome errado dá erro aqui, não depois do pagamento.
    const snapshot = await readPublicChannel(values.platform, url, { history: true })
    // Com a faturação ligada e sem subscrição: a página só é criada depois do pagamento.
    // As respostas ficam guardadas no Checkout do Stripe e a página é criada no regresso.
    if (billingConfigured() && !isActive(await getSubscription(user.id))) {
      return { next: await checkoutUrl({ userId: user.id, email: user.email, plan: 'monthly', next: '/dashboard',
        cancel: '/dashboard/novo?pagamento=cancelado', metadata: encodeOnboarding(values) }) }
    }
    return await createOnboardingPage(user, values, snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return { error: /^(Introduz |O URL |Não foi possível consultar|A plataforma devolveu|O canal devolvido)/.test(message)
      ? message : 'Não foi possível concluir. Os teus dados foram mantidos; tenta novamente.' }
  }
}
