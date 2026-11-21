import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'
import { saveSubscription, stripe } from '@/lib/billing/stripe'
import { expirePrizeCheckout, refundPrizeCharge, settlePrizeCheckout } from '@/lib/prizes/payments'
import { saveStripeAccount } from '@/lib/prizes/payouts'

export const dynamic = 'force-dynamic'

/**
 * Eventos do Stripe: subscrições e prémios (STRIPE_WEBHOOK_SECRET) e contas dos clippers, que chegam pelo
 * webhook "Connect" (STRIPE_CONNECT_WEBHOOK_SECRET). Os dois apontam para este endereço.
 */
export async function POST(request: Request) {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].map(s => s?.trim()).filter((s): s is string => !!s)
  const signature = request.headers.get('stripe-signature')
  if (!secrets.length || !signature) return NextResponse.json({ error: 'Não configurado.' }, { status: 400 })
  const body = await request.text()
  let event: Stripe.Event | null = null
  for (const secret of secrets) {
    try { event = stripe().webhooks.constructEvent(body, signature, secret); break } catch { /* tenta o outro segredo */ }
  }
  if (!event) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 })

  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.trial_will_end') {
      await saveSubscription(event.data.object)
    } else if (event.type === 'checkout.session.completed' && event.data.object.metadata?.kind === 'prize_payment') {
      await settlePrizeCheckout(event.data.object)
    } else if (event.type === 'checkout.session.async_payment_succeeded') {
      await settlePrizeCheckout(event.data.object)
    } else if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
      await expirePrizeCheckout(event.data.object)
    } else if (event.type === 'charge.refunded') {
      await refundPrizeCharge(event.data.object)
    } else if (event.type === 'account.updated') {
      await saveStripeAccount(event.data.object)
    } else if (event.type === 'checkout.session.completed' && event.data.object.subscription) {
      const id = event.data.object.subscription
      await saveSubscription(await stripe().subscriptions.retrieve(typeof id === 'string' ? id : id.id))
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const id = event.data.object.subscription
      if (id) await saveSubscription(await stripe().subscriptions.retrieve(typeof id === 'string' ? id : id.id))
    }
  } catch (error) {
    // 500 → o Stripe volta a tentar mais tarde.
    console.error('[stripe webhook]', event.type, error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Falhou; o Stripe vai repetir.' }, { status: 500 })
  }
  // A página pública passa a pública (ou em pausa) logo, sem esperar pela cache.
  revalidatePath('/', 'layout')
  return NextResponse.json({ received: true })
}
