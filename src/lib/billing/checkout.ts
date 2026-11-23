import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicEnv } from '@/lib/config/env'
import { FREE_DAYS, getSubscription, isStaleStripeId, priceFor, stripe, type Plan } from './stripe'

const appUrl = () => (publicEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
/** Só caminhos internos (evita redirecionar para outro site). */
export const safeNext = (value: unknown, fallback = '/dashboard') => {
  const next = typeof value === 'string' ? value : ''
  return next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

/** Cliente Stripe deste perfil (criado uma vez e guardado). */
async function customerFor(profileId: string, email: string | undefined) {
  const current = await getSubscription(profileId)
  const stale = current?.stripe_customer_id ?? null
  if (stale) {
    // Confirma que o cliente existe neste modo do Stripe (os criados com chaves de teste não existem em live).
    try {
      const existing = await stripe().customers.retrieve(stale)
      if (!existing.deleted) return stale
    } catch (error) {
      if (!isStaleStripeId(error)) throw error
    }
  }
  const customer = await stripe().customers.create({ email, metadata: { profile_id: profileId } },
    { idempotencyKey: `farmerrr-customer-${profileId}${stale ? `-${stale}` : ''}` })
  // Um cliente novo começa sem subscrição: a antiga (de teste ou apagada) deixa de valer.
  const { error } = await createAdminClient().from('subscriptions').upsert(
    { profile_id: profileId, stripe_customer_id: customer.id, ...(stale ? { stripe_subscription_id: null } : {}),
      ...(current?.plan === 'cortesia' ? {} : { status: 'incomplete' as const }) },
    { onConflict: 'profile_id' })
  if (error) throw error
  return customer.id
}

/** Ainda tem direito aos dias grátis? Não, se já houve alguma subscrição — no nosso registo ou no Stripe (em qualquer estado). */
export async function freeDaysAvailable(knownSubscriptionId: string | null, customerId: string) {
  if (knownSubscriptionId) return false
  const previous = await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 1 })
  return previous.data.length === 0
}

/**
 * URL do Checkout do Stripe. Na primeira subscrição, os primeiros FREE_DAYS dias são grátis: a faturação só começa
 * mais tarde (billing_cycle_anchor) — o Stripe mostra "0 € hoje" em vez de um título "X dias grátis".
 * No plano mensal, o Checkout oferece mudar para o anual (upsell configurado no preço, no dashboard do Stripe).
 * `next`: para onde voltar depois de pagar. `cancel`: para onde voltar se desistir.
 * `metadata`: guardado no Checkout (as respostas do assistente, para criar a página depois do pagamento).
 */
export async function checkoutUrl({ userId, email, plan, next, cancel, metadata }: { userId: string; email?: string; plan: Plan; next: string; cancel: string; metadata?: Record<string, string> }) {
  const customer = await customerFor(userId, email)
  const current = await getSubscription(userId)
  // Os dias grátis são só uma vez por conta: quem já teve uma subscrição paga desde o primeiro dia.
  // Confirma-se também no próprio Stripe (fonte de verdade), para o caso de o nosso registo se ter perdido.
  const free = await freeDaysAvailable(current?.stripe_subscription_id ?? null, customer)
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription', customer, client_reference_id: userId, locale: 'pt', metadata,
    line_items: [{ price: priceFor(plan), quantity: 1 }],
    payment_method_collection: 'always',
    subscription_data: { metadata: { profile_id: userId },
      ...(free ? { billing_cycle_anchor: Math.floor(Date.now() / 1000) + FREE_DAYS * 86400, proration_behavior: 'none' as const } : {}) },
    success_url: `${appUrl()}/api/stripe/retorno?session_id={CHECKOUT_SESSION_ID}&seguinte=${encodeURIComponent(next)}`,
    cancel_url: `${appUrl()}${cancel}`,
  })
  return session.url!
}
