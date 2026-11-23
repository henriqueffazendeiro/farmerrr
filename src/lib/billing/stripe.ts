import 'server-only'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SubscriptionStatus } from '@/lib/db/types'

/**
 * Subscrição do streamer (plano mensal 25 € / anual 200 €). Os primeiros 14 dias são grátis (uma vez por conta):
 * a faturação começa 14 dias depois (billing_cycle_anchor), com cartão pedido logo no Checkout.
 * Sem STRIPE_SECRET_KEY + preços configurados, a faturação fica desligada e nada é bloqueado.
 */
export const FREE_DAYS = 14
export type Plan = 'monthly' | 'yearly'

const env = (name: string) => process.env[name]?.trim() || ''
export const priceFor = (plan: Plan) => env(plan === 'monthly' ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_YEARLY')
export const billingConfigured = () => Boolean(env('STRIPE_SECRET_KEY') && priceFor('monthly') && priceFor('yearly'))

/**
 * O ID guardado não existe nesta conta/modo do Stripe: foi criado com chaves de teste (e agora usamos live),
 * ou foi apagado no dashboard. Nesses casos cria-se um novo em vez de falhar.
 */
export function isStaleStripeId(error: unknown) {
  const e = error as { code?: string; raw?: { code?: string }; message?: string } | null
  const code = e?.code ?? e?.raw?.code
  return code === 'resource_missing' || code === 'account_invalid'
    || /testmode key|test mode key|livemode key|No such (customer|account)/i.test(e?.message ?? '')
}

let client: Stripe | null = null
export function stripe() {
  if (!client) client = new Stripe(env('STRIPE_SECRET_KEY'), { apiVersion: '2025-02-24.acacia', appInfo: { name: 'farmerrr' } })
  return client
}

export type SubscriptionRow = {
  status: SubscriptionStatus
  plan: string
  trial_ends_at: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

/** Estados que mantêm a página pública. 'past_due': o Stripe ainda está a tentar cobrar (dá margem ao streamer). */
export const ACTIVE_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due']
export const isActive = (row: Pick<SubscriptionRow, 'status'> | null | undefined) => !!row && ACTIVE_STATUSES.includes(row.status)

export async function getSubscription(profileId: string): Promise<SubscriptionRow | null> {
  const { data } = await createAdminClient().from('subscriptions')
    .select('status,plan,trial_ends_at,current_period_end,stripe_customer_id,stripe_subscription_id')
    .eq('profile_id', profileId).maybeSingle()
  return data
}

/** A página deste creator pode estar pública? Sem faturação configurada, sim (desenvolvimento / antes de ligar o Stripe). */
export async function creatorHasAccess(creatorId: string) {
  if (!billingConfigured()) return true
  const db = createAdminClient()
  const { data: creator } = await db.from('creators').select('owner_id').eq('id', creatorId).maybeSingle()
  if (!creator) return false
  return isActive(await getSubscription(creator.owner_id))
}

const statusOf = (status: Stripe.Subscription.Status): SubscriptionStatus =>
  status === 'trialing' || status === 'active' || status === 'past_due' ? status
    : status === 'incomplete' ? 'incomplete' : 'canceled' // unpaid, incomplete_expired, paused, canceled

const iso = (seconds: number | null | undefined) => seconds ? new Date(seconds * 1000).toISOString() : null

/** Copia o estado de uma subscrição do Stripe para a nossa base de dados (fonte de verdade: o Stripe). */
export async function saveSubscription(subscription: Stripe.Subscription) {
  const db = createAdminClient()
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  let profileId: string | undefined = subscription.metadata?.profile_id
  if (!profileId) {
    const { data } = await db.from('subscriptions').select('profile_id').eq('stripe_customer_id', customerId).maybeSingle()
    profileId = data?.profile_id
  }
  if (!profileId) throw new Error(`Subscrição ${subscription.id} sem perfil associado.`)
  // Uma subscrição antiga (já substituída) não pode apagar o estado da atual.
  const { data: current } = await db.from('subscriptions').select('stripe_subscription_id,status').eq('profile_id', profileId).maybeSingle()
  if (current?.stripe_subscription_id && current.stripe_subscription_id !== subscription.id && isActive(current)
    && !ACTIVE_STATUSES.includes(statusOf(subscription.status))) return
  const price = subscription.items.data[0]?.price.id
  const { error } = await db.from('subscriptions').upsert({
    profile_id: profileId, stripe_customer_id: customerId, stripe_subscription_id: subscription.id,
    status: statusOf(subscription.status),
    plan: price === priceFor('yearly') ? 'yearly' : price === priceFor('monthly') ? 'monthly' : 'creator',
    trial_ends_at: iso(subscription.trial_end), current_period_end: iso(subscription.current_period_end),
  }, { onConflict: 'profile_id' })
  if (error) throw error
}
