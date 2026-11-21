import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CircleCheck } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMyCreator, getMyLeaderboard } from '@/lib/db/queries'
import { billingConfigured, getSubscription, isActive } from '@/lib/billing/stripe'
import { openBillingPortal } from '@/lib/billing/actions'
import { checkoutUrl } from '@/lib/billing/checkout'

export const metadata: Metadata = { title: 'Subscrição', robots: { index: false, follow: false } }

/**
 * Encaminhamento da subscrição (já não há página de planos):
 * - acesso de cortesia → aviso "Acesso gratuito";  - subscrição paga → portal do Stripe;
 * - sem subscrição → Checkout do Stripe (ou o assistente, se ainda não houver página).
 */
export default async function SubscriptionPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar?seguinte=/dashboard')
  const [subscription, creator] = await Promise.all([getSubscription(user.id), getMyCreator()])
  const leaderboard = creator ? await getMyLeaderboard(creator.id) : null
  const active = isActive(subscription)
  if (active && subscription?.plan === 'cortesia') return <Container className="pt-10 pb-32 sm:pt-14">
    <Link href={leaderboard ? `/${leaderboard.slug}` : '/dashboard'} className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar
    </Link>
    <div className="flex flex-wrap items-center gap-3 rounded-xs border border-line bg-surface/60 p-6">
      <CircleCheck className="h-5 w-5 text-accent" aria-hidden="true" />
      <span className="font-medium">Acesso gratuito</span>
      <span className="text-sm text-fg-muted">A tua página está sempre ativa, sem pagamentos.</span>
    </div>
  </Container>
  if (active && subscription?.stripe_subscription_id) await openBillingPortal()
  if (!leaderboard) redirect('/dashboard/novo')
  if (active || !billingConfigured()) redirect(`/${leaderboard.slug}`)
  const page = `/${leaderboard.slug}`
  redirect(await checkoutUrl({ userId: user.id, email: user.email, plan: 'monthly', next: page, cancel: page }))
}
