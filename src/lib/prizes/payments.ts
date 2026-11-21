import 'server-only'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicEnv } from '@/lib/config/env'
import { getSubscription, stripe } from '@/lib/billing/stripe'
import { currentPeriodKey, periodLabel, periodTitle, ALL_TIME } from '@/lib/period'
import type { Leaderboard, PrizePayment, PrizePayout } from '@/lib/db/types'
import { closedPeriods, feeFor, netOf, splitPrizes, type DuePrize, type PrizeShare } from './model'

const appUrl = () => (publicEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
/** Pagar prémios só precisa da chave do Stripe (não dos preços da subscrição). */
export const prizesConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY?.trim())
export const prizeTitle = (periodKey: string) => periodKey === ALL_TIME ? 'Prémios da competição' : `Prémios de ${periodTitle(periodKey).replace('Corrida de ', '')}`

type Board = Pick<Leaderboard, 'id' | 'name' | 'period_mode' | 'timezone' | 'ends_at' | 'status'>

/** Períodos fechados deste leaderboard (mais recente primeiro). */
export async function payablePeriods(board: Board) {
  const { data, error } = await createAdminClient().from('leaderboard_entries').select('period_key').eq('leaderboard_id', board.id)
  if (error) throw error
  return closedPeriods(board, (data ?? []).map(row => row.period_key), currentPeriodKey(board))
}

/** Quem ganha quanto neste período, pelo ranking final e pelos prémios definidos. */
export async function prizeSplit(leaderboardId: string, periodKey: string): Promise<PrizeShare[]> {
  const db = createAdminClient()
  const { data: rewards, error } = await db.from('rewards').select('position,amount_cents').eq('leaderboard_id', leaderboardId)
  if (error) throw error
  const positions = (rewards ?? []).filter(r => (r.amount_cents ?? 0) > 0).map(r => r.position)
  if (!positions.length) return []
  const { data: entries, error: entriesError } = await db.from('leaderboard_entries').select('participant_id,rank')
    .eq('leaderboard_id', leaderboardId).eq('period_key', periodKey).in('rank', positions)
  if (entriesError) throw entriesError
  const ids = (entries ?? []).map(e => e.participant_id)
  if (!ids.length) return []
  // Desqualificados não recebem (a posição fica sem prémio).
  const { data: participants, error: participantsError } = await db.from('leaderboard_participants')
    .select('id,clipper_profile_id').in('id', ids).eq('status', 'active')
  if (participantsError) throw participantsError
  const profileOf = new Map((participants ?? []).map(p => [p.id, p.clipper_profile_id]))
  return splitPrizes(rewards ?? [], (entries ?? []).filter(e => profileOf.has(e.participant_id))
    .map(e => ({ rank: e.rank, participantId: e.participant_id, clipperProfileId: profileOf.get(e.participant_id)! })))
}

/** Os prémios do período que acabou de fechar, se ainda não foram entregues. Os mais antigos ficam nas Definições. */
export async function duePrize(board: Board): Promise<DuePrize | null> {
  if (!prizesConfigured()) return null
  const [periodKey] = await payablePeriods(board)
  return periodKey ? prizeFor(board, periodKey) : null
}

/**
 * Os prémios do período que está a decorrer, pelo ranking atual. A página mostra logo o "Entregar prémios"
 * quando o contador chega a zero, sem esperar pelo servidor; depois o refresh traz os valores finais.
 */
export async function upcomingPrize(board: Board): Promise<DuePrize | null> {
  if (!prizesConfigured()) return null
  return prizeFor(board, currentPeriodKey(board))
}

async function prizeFor(board: Board, periodKey: string): Promise<DuePrize | null> {
  if (await paidPayment(board.id, periodKey)) return null
  const split = await prizeSplit(board.id, periodKey)
  if (!split.length) return null
  const ids = split.map(share => share.clipperProfileId)
  const db = createAdminClient()
  const [{ data: profiles }, { data: accounts }] = await Promise.all([
    db.from('clipper_profiles').select('id,display_name,avatar_url,discord').in('id', ids),
    db.from('social_accounts').select('clipper_profile_id,username,avatar_url').in('clipper_profile_id', ids).eq('provider', 'tiktok'),
  ])
  const profileOf = new Map((profiles ?? []).map(p => [p.id, p]))
  const accountOf = new Map((accounts ?? []).map(a => [a.clipper_profile_id, a]))
  return { periodKey, periodName: periodKey === ALL_TIME ? 'A competição' : periodLabel(periodKey),
    amountCents: split.reduce((sum, share) => sum + share.amountCents, 0),
    winners: split.map(share => ({ position: share.position, amountCents: share.amountCents,
      name: profileOf.get(share.clipperProfileId)?.display_name ?? 'Clipper', username: accountOf.get(share.clipperProfileId)?.username ?? null,
      discord: profileOf.get(share.clipperProfileId)?.discord ?? null,
      avatarUrl: profileOf.get(share.clipperProfileId)?.avatar_url ?? accountOf.get(share.clipperProfileId)?.avatar_url ?? null })) }
}

/**
 * Pagamento manual: o streamer pagou diretamente a cada clipper. Fica registado como entregue (sem taxa e sem saque
 * no site), para o retângulo desaparecer e os clippers verem o prémio como pago.
 */
export async function recordManualPayment(board: Board, periodKey: string) {
  if (!(await payablePeriods(board)).includes(periodKey)) throw new Error('Este período ainda não terminou.')
  if (await paidPayment(board.id, periodKey)) return
  const split = await prizeSplit(board.id, periodKey)
  if (!split.length) throw new Error('Não há prémios para entregar neste período.')
  const db = createAdminClient()
  const now = new Date().toISOString()
  const { data: payment, error } = await db.from('prize_payments').insert({
    leaderboard_id: board.id, period_key: periodKey, method: 'manual', status: 'paid', paid_at: now,
    prizes_cents: split.reduce((sum, share) => sum + share.amountCents, 0), fee_cents: 0,
  }).select('id').single()
  if (error?.code === '23505') return // já entregue (dois cliques)
  if (error) throw error
  const { error: payoutsError } = await db.from('prize_payouts').insert(split.map(share => ({
    payment_id: payment.id, position: share.position, amount_cents: share.amountCents, fee_cents: 0, status: 'paid' as const,
    participant_id: share.participantId, clipper_profile_id: share.clipperProfileId, transferred_at: now,
  })))
  if (payoutsError) throw payoutsError
}

export async function paidPayment(leaderboardId: string, periodKey: string) {
  const { data } = await createAdminClient().from('prize_payments').select('*')
    .eq('leaderboard_id', leaderboardId).eq('period_key', periodKey).eq('status', 'paid').maybeSingle()
  return data as PrizePayment | null
}

export async function payoutsOf(paymentId: string) {
  const { data, error } = await createAdminClient().from('prize_payouts').select('*').eq('payment_id', paymentId).order('position')
  if (error) throw error
  return (data ?? []) as PrizePayout[]
}

/**
 * Cria o Checkout do Stripe com o valor exato dos prémios (os 5% saem da parte de cada clipper). A divisão fica guardada já (a "fotografia" do ranking
 * final) e só passa a poder ser sacada quando o pagamento for confirmado.
 */
export async function createPrizeCheckout({ userId, email, board, periodKey, returnPath }: {
  userId: string; email?: string; board: Board; periodKey: string; returnPath: string
}) {
  if (!(await payablePeriods(board)).includes(periodKey)) throw new Error('Este período ainda não terminou.')
  if (await paidPayment(board.id, periodKey)) throw new Error('Os prémios deste período já foram pagos.')
  const split = await prizeSplit(board.id, periodKey)
  if (!split.length) throw new Error('Não há prémios para pagar neste período.')
  const prizes = split.reduce((sum, share) => sum + share.amountCents, 0)
  const fee = split.reduce((sum, share) => sum + feeFor(share.amountCents), 0)

  const db = createAdminClient()
  const { data: payment, error } = await db.from('prize_payments')
    .insert({ leaderboard_id: board.id, period_key: periodKey, prizes_cents: prizes, fee_cents: fee }).select('id').single()
  if (error) throw error
  const { error: payoutsError } = await db.from('prize_payouts').insert(split.map(share => ({
    payment_id: payment.id, position: share.position, amount_cents: netOf(share.amountCents), fee_cents: feeFor(share.amountCents),
    participant_id: share.participantId, clipper_profile_id: share.clipperProfileId,
  })))
  if (payoutsError) throw payoutsError

  const customer = (await getSubscription(userId))?.stripe_customer_id
  const metadata = { kind: 'prize_payment', prize_payment_id: payment.id, leaderboard_id: board.id, period_key: periodKey }
  const title = prizeTitle(periodKey)
  const session = await stripe().checkout.sessions.create({
    mode: 'payment', locale: 'pt', client_reference_id: userId, metadata,
    ...(customer ? { customer } : { customer_email: email }),
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: prizes,
      product_data: { name: `${title} — ${board.name}`, description: `${split.length} ${split.length === 1 ? 'clipper' : 'clippers'} premiados` } } }],
    payment_intent_data: { transfer_group: `prize_${payment.id}`, metadata, description: `${title} — ${board.name}` },
    success_url: `${appUrl()}/api/stripe/retorno?session_id={CHECKOUT_SESSION_ID}&seguinte=${encodeURIComponent(returnPath)}`,
    cancel_url: `${appUrl()}${returnPath}`,
  })
  await db.from('prize_payments').update({ stripe_checkout_session_id: session.id }).eq('id', payment.id)
  return session.url!
}

const idOf = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id ?? null

/**
 * Checkout concluído (webhook ou regresso do Checkout). Pode ser chamado várias vezes.
 * Multibanco é assíncrono: a sessão termina "unpaid" e o pagamento chega mais tarde (async_payment_succeeded).
 * Devolve null se a sessão não for de prémios.
 */
export async function settlePrizeCheckout(session: Stripe.Checkout.Session): Promise<'paid' | 'processing' | 'refunded' | null> {
  const paymentId = session.metadata?.kind === 'prize_payment' ? session.metadata.prize_payment_id : null
  if (!paymentId) return null
  if (session.payment_status !== 'paid') return 'processing'
  const intentId = idOf(session.payment_intent)
  if (!intentId) return 'processing'
  const intent = await stripe().paymentIntents.retrieve(intentId)
  const db = createAdminClient()
  const { data: updated, error } = await db.from('prize_payments')
    .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent_id: intentId, stripe_charge_id: idOf(intent.latest_charge) })
    .eq('id', paymentId).eq('status', 'pending').select('id')
  if (error?.code === '23505') {
    // Já havia outro pagamento deste período (ex.: dois Checkouts abertos, um por Multibanco): devolve-se este.
    await stripe().refunds.create({ payment_intent: intentId, reason: 'duplicate' }, { idempotencyKey: `prize-duplicate-${paymentId}` })
    await db.from('prize_payments').update({ status: 'refunded', stripe_payment_intent_id: intentId }).eq('id', paymentId)
    await db.from('prize_payouts').update({ status: 'canceled' }).eq('payment_id', paymentId)
    return 'refunded'
  }
  if (error) throw error
  if (updated?.length) await db.from('prize_payouts').update({ status: 'available' }).eq('payment_id', paymentId).eq('status', 'awaiting_payment')
  return 'paid'
}

/** Checkout abandonado ou Multibanco que não foi pago a tempo. */
export async function expirePrizeCheckout(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.kind === 'prize_payment' ? session.metadata.prize_payment_id : null
  if (!paymentId) return
  const db = createAdminClient()
  await db.from('prize_payments').update({ status: 'expired' }).eq('id', paymentId).eq('status', 'pending')
  await db.from('prize_payouts').update({ status: 'canceled' }).eq('payment_id', paymentId).eq('status', 'awaiting_payment')
}

/**
 * O pagamento do streamer foi reembolsado por completo (no dashboard do Stripe): os prémios ainda não sacados deixam de
 * estar disponíveis. Os que já foram transferidos ficam como estão (podem ser revertidos à mão no Stripe).
 */
export async function refundPrizeCharge(charge: Stripe.Charge) {
  if (!charge.refunded) return
  const db = createAdminClient()
  const { data: payment } = await db.from('prize_payments').select('id').eq('stripe_charge_id', charge.id).maybeSingle()
  if (!payment) return
  await db.from('prize_payments').update({ status: 'refunded' }).eq('id', payment.id)
  await db.from('prize_payouts').update({ status: 'canceled' }).eq('payment_id', payment.id).in('status', ['awaiting_payment', 'available'])
}
