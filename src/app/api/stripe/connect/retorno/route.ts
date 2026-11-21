import { NextResponse, type NextRequest } from 'next/server'
import { getClipperMembership } from '@/lib/clippers/session'
import { ensurePayoutAccount, withdrawPrizes } from '@/lib/prizes/payouts'

export const dynamic = 'force-dynamic'

/**
 * Regresso do formulário do Stripe. Se a conta já pode receber, faz logo o saque que o clipper tinha pedido.
 * Se o Stripe ainda estiver a verificar os dados, os prémios ficam à espera (o clipper volta a carregar em "Sacar").
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('lb') || ''
  const back = new URL(`/${encodeURIComponent(slug)}`, request.url)
  const member = await getClipperMembership(slug)
  if (!member) return NextResponse.redirect(new URL(`/join/${encodeURIComponent(slug)}`, request.url))
  let notice = 'pendente'
  try {
    const account = await ensurePayoutAccount(member.participant.clipper_profile_id)
    if (account.transfers_enabled) {
      const { sentCents, failed } = await withdrawPrizes(member.participant.clipper_profile_id, account.stripe_account_id)
      notice = failed ? 'erro' : sentCents ? 'enviado' : 'ligada'
      if (notice === 'enviado') back.searchParams.set('valor', String(sentCents))
    } else if (!account.details_submitted) notice = 'incompleto'
  } catch (error) {
    console.error('[stripe connect retorno]', error instanceof Error ? error.message : error)
    notice = 'erro'
  }
  back.searchParams.set('premios', notice)
  return NextResponse.redirect(back)
}
