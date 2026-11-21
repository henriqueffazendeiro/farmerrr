import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'
import { saveSubscription, stripe } from '@/lib/billing/stripe'

export const dynamic = 'force-dynamic'

/** Estado da subscrição vindo do Stripe (assinado com STRIPE_WEBHOOK_SECRET). */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  const signature = request.headers.get('stripe-signature')
  if (!secret || !signature) return NextResponse.json({ error: 'Não configurado.' }, { status: 400 })
  let event: Stripe.Event
  try { event = stripe().webhooks.constructEvent(await request.text(), signature, secret) }
  catch { return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 }) }

  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.trial_will_end') {
      await saveSubscription(event.data.object)
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
