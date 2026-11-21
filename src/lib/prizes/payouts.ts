import 'server-only'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicEnv } from '@/lib/config/env'
import { stripe } from '@/lib/billing/stripe'
import type { ClipperPayoutAccount, PrizePayout } from '@/lib/db/types'
import { prizeTitle } from './payments'

const appUrl = () => (publicEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

/** leaderboardId/leaderboardName: a competição onde o prémio foi ganho (um clipper pode participar em várias). */
export type ClipperPrize = PrizePayout & { title: string; leaderboardId: string | null; leaderboardName: string; manual: boolean }

/** Prémios deste clipper (em todas as competições), mais recentes primeiro. */
export async function clipperPrizes(clipperProfileId: string): Promise<ClipperPrize[]> {
  const db = createAdminClient()
  const { data: payouts, error } = await db.from('prize_payouts').select('*').eq('clipper_profile_id', clipperProfileId)
    .in('status', ['available', 'transferring', 'paid']).order('created_at', { ascending: false })
  if (error) throw error
  if (!payouts?.length) return []
  const { data: payments } = await db.from('prize_payments').select('id,leaderboard_id,period_key,method').in('id', [...new Set(payouts.map(p => p.payment_id))])
  const boardIds = [...new Set((payments ?? []).map(p => p.leaderboard_id).filter((id): id is string => !!id))]
  const { data: boards } = boardIds.length ? await db.from('leaderboards').select('id,name').in('id', boardIds) : { data: [] }
  const paymentOf = new Map((payments ?? []).map(p => [p.id, p]))
  const nameOf = new Map((boards ?? []).map(b => [b.id, b.name]))
  return payouts.map(payout => {
    const payment = paymentOf.get(payout.payment_id)
    return { ...payout, title: payment ? prizeTitle(payment.period_key) : 'Prémio', leaderboardId: payment?.leaderboard_id ?? null,
      leaderboardName: (payment?.leaderboard_id && nameOf.get(payment.leaderboard_id)) || '', manual: payment?.method === 'manual' }
  })
}

export async function payoutAccount(clipperProfileId: string) {
  const { data } = await createAdminClient().from('clipper_payout_accounts').select('*').eq('clipper_profile_id', clipperProfileId).maybeSingle()
  return data as ClipperPayoutAccount | null
}

/** Copia o estado da conta Express do Stripe (webhook account.updated ou regresso do onboarding). */
export async function saveStripeAccount(account: Stripe.Account) {
  const { error } = await createAdminClient().from('clipper_payout_accounts').update({
    transfers_enabled: account.capabilities?.transfers === 'active',
    details_submitted: Boolean(account.details_submitted),
  }).eq('stripe_account_id', account.id)
  if (error) throw error
}

/** Conta Stripe Express do clipper: criada na primeira vez que carrega em "Sacar". Atualiza o estado a partir do Stripe. */
export async function ensurePayoutAccount(clipperProfileId: string) {
  const db = createAdminClient()
  let row = await payoutAccount(clipperProfileId)
  if (!row) {
    const account = await stripe().accounts.create({
      type: 'express', country: 'PT', business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      business_profile: { product_description: 'Prémios ganhos em competições de clips no farmerrr' },
      metadata: { clipper_profile_id: clipperProfileId },
    }, { idempotencyKey: `farmerrr-clipper-account-${clipperProfileId}` })
    const { error } = await db.from('clipper_payout_accounts')
      .upsert({ clipper_profile_id: clipperProfileId, stripe_account_id: account.id }, { onConflict: 'clipper_profile_id', ignoreDuplicates: true })
    if (error) throw error
    row = await payoutAccount(clipperProfileId)
    if (!row) throw new Error('Não foi possível guardar a conta de pagamentos.')
  }
  if (!row.transfers_enabled) {
    const account = await stripe().accounts.retrieve(row.stripe_account_id)
    await saveStripeAccount(account)
    row = { ...row, transfers_enabled: account.capabilities?.transfers === 'active', details_submitted: Boolean(account.details_submitted) }
  }
  return row
}

/** Formulário do Stripe (dados pessoais + IBAN). Os links expiram depressa: cria-se um novo de cada vez. */
export async function onboardingUrl(stripeAccountId: string, slug: string) {
  const lb = encodeURIComponent(slug)
  const link = await stripe().accountLinks.create({
    account: stripeAccountId, type: 'account_onboarding', collect: 'eventually_due',
    refresh_url: `${appUrl()}/api/stripe/connect/onboarding?lb=${lb}`,
    return_url: `${appUrl()}/api/stripe/connect/retorno?lb=${lb}`,
  })
  return link.url
}

/** Painel Express do clipper: ver os pagamentos para o banco e mudar o IBAN. */
export async function expressDashboardUrl(stripeAccountId: string) {
  return (await stripe().accounts.createLoginLink(stripeAccountId)).url
}

/**
 * Transfere para a conta do clipper todos os prémios disponíveis. Cada prémio é "reservado" antes da transferência
 * (available → transferring) para dois cliques seguidos não pagarem duas vezes; a chave de idempotência garante o mesmo
 * no lado do Stripe. Um prémio preso em "transferring" (processo interrompido) volta a ser tentado após 5 minutos.
 * O Stripe envia depois o saldo para o IBAN do clipper, sozinho.
 */
export async function withdrawPrizes(clipperProfileId: string, stripeAccountId: string) {
  const db = createAdminClient()
  const stale = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data: candidates, error } = await db.from('prize_payouts').select('id').eq('clipper_profile_id', clipperProfileId)
    .or(`status.eq.available,and(status.eq.transferring,updated_at.lt.${stale})`)
  if (error) throw error
  let sentCents = 0
  let failed = 0
  for (const { id } of candidates ?? []) {
    const { data: claimed } = await db.from('prize_payouts').update({ status: 'transferring', last_error: null }).eq('id', id)
      .or(`status.eq.available,and(status.eq.transferring,updated_at.lt.${stale})`).select('*').maybeSingle()
    if (!claimed) continue
    const { data: payment } = await db.from('prize_payments').select('id,status,stripe_charge_id').eq('id', claimed.payment_id).maybeSingle()
    if (payment?.status !== 'paid' || !payment.stripe_charge_id) {
      await db.from('prize_payouts').update({ status: payment?.status === 'refunded' ? 'canceled' : 'available' }).eq('id', id)
      continue
    }
    try {
      const transfer = await stripe().transfers.create({
        amount: claimed.amount_cents, currency: claimed.currency.toLowerCase(), destination: stripeAccountId,
        // Ligada à cobrança do streamer: pode sair já, mesmo antes de o dinheiro ficar disponível no saldo da plataforma.
        source_transaction: payment.stripe_charge_id, transfer_group: `prize_${payment.id}`,
        description: 'Prémio farmerrr', metadata: { prize_payout_id: id, clipper_profile_id: clipperProfileId },
      }, { idempotencyKey: `farmerrr-prize-payout-${id}` })
      await db.from('prize_payouts').update({ status: 'paid', stripe_transfer_id: transfer.id, transferred_at: new Date().toISOString() }).eq('id', id)
      sentCents += claimed.amount_cents
    } catch (cause) {
      failed++
      const message = cause instanceof Error ? cause.message : String(cause)
      console.error('[prize payout]', id, message)
      await db.from('prize_payouts').update({ status: 'available', last_error: message.slice(0, 500) }).eq('id', id)
    }
  }
  return { sentCents, failed }
}
