'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/server'
import { getOwnedLeaderboard } from '@/lib/db/queries'
import { getClipperMembership } from '@/lib/clippers/session'
import { safeNext } from '@/lib/billing/checkout'
import { createPrizeCheckout, prizesConfigured, recordManualPayment } from './payments'
import { ensurePayoutAccount, expressDashboardUrl, onboardingUrl, payoutAccount, withdrawPrizes } from './payouts'

const text = (form: FormData, name: string) => String(form.get(name) ?? '')

/** Streamer: "Entregar prémios" → Checkout do Stripe com o total do período. Volta a `returnTo` (ou às Definições). */
export async function payPrizesAction(form: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar?seguinte=/dashboard')
  const board = await getOwnedLeaderboard(text(form, 'leaderboardId'))
  if (!board) redirect('/dashboard')
  const back = safeNext(form.get('returnTo'), `/dashboard/l/${board.id}/definicoes`)
  if (!prizesConfigured()) redirect(`${back}${back.includes('?') ? '&' : '?'}premios=indisponivel`)
  let url: string
  try {
    url = await createPrizeCheckout({ userId: user.id, email: user.email, board, periodKey: text(form, 'periodKey'), returnPath: back })
  } catch (error) {
    console.error('[prize checkout]', error instanceof Error ? error.message : error)
    redirect(`${back}${back.includes('?') ? '&' : '?'}premios=erro`)
  }
  redirect(url)
}

/** Streamer: "Já paguei a todos" (pagamento manual, fora do site). */
export async function markPrizesManualAction(form: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar?seguinte=/dashboard')
  const board = await getOwnedLeaderboard(text(form, 'leaderboardId'))
  if (!board) redirect('/dashboard')
  const back = safeNext(form.get('returnTo'), `/dashboard/l/${board.id}/definicoes`)
  const join = back.includes('?') ? '&' : '?'
  let notice = 'entregue'
  try { await recordManualPayment(board, text(form, 'periodKey')) }
  catch (error) {
    console.error('[prize manual]', error instanceof Error ? error.message : error)
    notice = 'erro'
  }
  redirect(`${back}${join}premios=${notice}`)
}

/**
 * Clipper: "Sacar". Na primeira vez abre o formulário do Stripe (dados + IBAN) e, ao voltar, o saque é feito
 * sozinho (/api/stripe/connect/retorno). Depois disso é só este clique.
 */
export async function withdrawPrizesAction(form: FormData) {
  const slug = text(form, 'slug')
  // Volta sempre à página da competição: o "Prémio levantado" abre num pop-up, os avisos nas definições.
  const back = `/${encodeURIComponent(slug)}`
  const member = await getClipperMembership(slug)
  if (!member) redirect(`/join/${encodeURIComponent(slug)}`)
  if (!prizesConfigured()) redirect(`${back}?premios=indisponivel`)
  let next: string
  try {
    const account = await ensurePayoutAccount(member.participant.clipper_profile_id)
    if (!account.transfers_enabled) next = await onboardingUrl(account.stripe_account_id, slug)
    else {
      const { sentCents, failed } = await withdrawPrizes(member.participant.clipper_profile_id, account.stripe_account_id)
      next = `${back}?premios=${failed ? 'erro' : sentCents ? `enviado&valor=${sentCents}` : 'nada'}`
    }
  } catch (error) {
    console.error('[prize withdraw]', error instanceof Error ? error.message : error)
    next = `${back}?premios=erro`
  }
  redirect(next)
}

/** Clipper: painel do Stripe (ver quando chega ao banco, mudar o IBAN). */
export async function openPayoutDashboardAction(form: FormData) {
  const slug = text(form, 'slug')
  const member = await getClipperMembership(slug)
  if (!member) redirect(`/join/${encodeURIComponent(slug)}`)
  const account = await payoutAccount(member.participant.clipper_profile_id)
  let next = `/${encodeURIComponent(slug)}?premios=erro`
  if (account?.details_submitted) {
    try { next = await expressDashboardUrl(account.stripe_account_id) }
    catch (error) { console.error('[prize dashboard]', error instanceof Error ? error.message : error) }
  }
  redirect(next)
}
