'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/config/env'
import { billingConfigured, getSubscription, isActive, isStaleStripeId, stripe } from './stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkoutUrl, safeNext } from './checkout'

const appUrl = () => (publicEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

/**
 * "Ativar subscrição" → direto para o Checkout do Stripe (plano mensal; no próprio Checkout dá para mudar para o anual).
 * Depois de pagar, ou se desistir, volta a `next` (a página do streamer).
 */
export async function startCheckout(form: FormData) {
  const user = await getCurrentUser()
  const next = safeNext(form.get('next'))
  if (!user) redirect('/entrar?seguinte=/dashboard')
  if (!billingConfigured() || isActive(await getSubscription(user.id))) redirect(next)
  redirect(await checkoutUrl({ userId: user.id, email: user.email, plan: form.get('plan') === 'yearly' ? 'yearly' : 'monthly', next, cancel: next }))
}

/**
 * "Gerir subscrição": abre o portal do Stripe, onde o streamer muda de plano, troca o cartão,
 * vê e baixa as faturas e cancela. No fim volta à página dele.
 * Com acesso de cortesia mostra o aviso de acesso gratuito; sem subscrição, volta à página (que tem o "Ativar subscrição").
 */
export async function openBillingPortal() {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar?seguinte=/dashboard')
  const current = await getSubscription(user.id)
  if (current?.plan === 'cortesia') redirect('/dashboard/subscricao')
  if (!billingConfigured() || !current?.stripe_customer_id || !current.stripe_subscription_id) redirect('/dashboard')
  let url: string
  try {
    url = (await stripe().billingPortal.sessions.create({ customer: current.stripe_customer_id, locale: 'pt', return_url: `${appUrl()}/dashboard` })).url
  } catch (error) {
    if (!isStaleStripeId(error)) throw error
    // Cliente de teste (ou apagado) não existe no Stripe live: a subscrição antiga deixa de valer
    // e a página de subscrição passa a oferecer ativá-la.
    await createAdminClient().from('subscriptions')
      .update({ stripe_customer_id: null, stripe_subscription_id: null, status: 'canceled' })
      .eq('profile_id', user.id).eq('stripe_customer_id', current.stripe_customer_id)
    redirect('/dashboard/subscricao')
  }
  redirect(url)
}
