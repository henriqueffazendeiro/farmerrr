import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/supabase/server'
import { saveSubscription, stripe } from '@/lib/billing/stripe'
import { createOnboardingPage, decodeOnboarding, existingPageSlug } from '@/lib/onboarding/create'
import { settlePrizeCheckout } from '@/lib/prizes/payments'

export const dynamic = 'force-dynamic'

/**
 * Regresso do Checkout: grava logo o estado da subscrição (o webhook pode chegar uns segundos depois).
 * Se o pagamento veio do assistente de criação, é agora que a página é criada — com as respostas
 * guardadas no Checkout — e abre com "Página pronta".
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const next = url.searchParams.get('seguinte') || '/dashboard'
  let destination = new URL(next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard', url.origin)
  const sessionId = url.searchParams.get('session_id')
  const user = await getCurrentUser()
  if (user && sessionId?.startsWith('cs_')) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
      const prize = session.client_reference_id === user.id ? await settlePrizeCheckout(session) : null
      if (prize) destination.searchParams.set('premios', prize === 'paid' ? 'pago' : prize === 'refunded' ? 'duplicado' : 'processando')
      else if (session.client_reference_id === user.id && session.subscription && typeof session.subscription !== 'string') {
        await saveSubscription(session.subscription)
        revalidatePath('/', 'layout')
        destination.searchParams.set('subscricao', 'ativa')
        const answers = decodeOnboarding(session.metadata)
        if (answers) {
          const slug = (await existingPageSlug(user.id)) ?? (await createOnboardingPage(user, answers)).slug
          // Se a criação falhar (raro: o canal deixou de existir…), a subscrição fica ativa e o assistente cria a página sem novo pagamento.
          destination = new URL(slug ? `/${slug}?criada=1` : '/dashboard/novo?pagamento=pago', url.origin)
        }
      }
    } catch (error) { console.error('[stripe retorno]', error instanceof Error ? error.message : error) }
  }
  return NextResponse.redirect(destination)
}
