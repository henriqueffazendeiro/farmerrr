import { NextResponse, type NextRequest } from 'next/server'
import { getClipperMembership } from '@/lib/clippers/session'
import { ensurePayoutAccount, onboardingUrl } from '@/lib/prizes/payouts'

export const dynamic = 'force-dynamic'

/** O link do formulário do Stripe expirou (ou o clipper recarregou a página): cria um novo e volta lá. */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('lb') || ''
  const back = new URL(`/${encodeURIComponent(slug)}`, request.url)
  const member = await getClipperMembership(slug)
  if (!member) return NextResponse.redirect(new URL(`/join/${encodeURIComponent(slug)}`, request.url))
  try {
    const account = await ensurePayoutAccount(member.participant.clipper_profile_id)
    if (account.transfers_enabled) return NextResponse.redirect(back)
    return NextResponse.redirect(await onboardingUrl(account.stripe_account_id, slug))
  } catch (error) {
    console.error('[stripe connect onboarding]', error instanceof Error ? error.message : error)
    back.searchParams.set('premios', 'erro')
    return NextResponse.redirect(back)
  }
}
