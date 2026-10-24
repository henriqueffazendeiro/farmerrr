import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getProvider } from '@/lib/providers/registry'
import { STATE_COOKIE, readState } from '@/lib/auth/oauth-state'
import { connectAccountToLeaderboard } from '@/lib/clippers/join'
import { CLIPPER_COOKIE, makeClipperSession } from '@/lib/recap/session'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Passo 2 do OAuth: troca o código por tokens, liga a conta ao leaderboard e
 * agenda a importação dos clips e abre a página de sucesso.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const nonce = request.cookies.get(STATE_COOKIE)?.value
  const payload = state ? readState(state, nonce) : null

  const backTo = (suffix: string) =>
    payload ? `${origin}/join/${payload.slug}${suffix}` : `${origin}/`

  if (error) return clearCookie(NextResponse.redirect(backTo('?erro=cancelado')))
  if (!payload || !code) {
    return clearCookie(NextResponse.redirect(backTo('?erro=estado')))
  }

  try {
    const provider = getProvider('tiktok')
    const tokens = await provider.exchangeCode(code)
    const account = await provider.getAccount(tokens)

    let participantId: string
    if (payload.recap) {
      const admin = createAdminClient()
      const { data: linked } = await admin.from('social_accounts').select('id, clipper_profile_id')
        .eq('provider', 'tiktok').eq('provider_user_id', account.providerUserId).maybeSingle()
      const { data: participant } = linked ? await admin.from('leaderboard_participants').select('id')
        .eq('leaderboard_id', payload.leaderboardId).eq('clipper_profile_id', linked.clipper_profile_id).maybeSingle() : { data: null }
      if (!linked || !participant) throw new Error('Esta conta não participou na competição.')
      participantId = participant.id
    } else {
      const joined = await connectAccountToLeaderboard({ leaderboardId: payload.leaderboardId, provider: 'tiktok', tokens, account })
      participantId = joined.participantId
    }

    // Import runs in the queued worker, avoiding OAuth timeouts and duplicate refreshes.

    revalidateTag(`lb:${payload.slug}`)

    const response = NextResponse.redirect(payload.recap
      ? `${origin}/${payload.slug}/recap${payload.recapMonth ? `?mes=${payload.recapMonth}` : ''}`
      : `${origin}/join/${payload.slug}/sucesso?p=${participantId}`)
    response.cookies.set(CLIPPER_COOKIE, makeClipperSession(participantId), {
      httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/', maxAge: 7 * 86400,
    })
    return clearCookie(response)
  } catch (exchangeError) {
    console.error('[farmerrr] callback do TikTok falhou', exchangeError)
    return clearCookie(NextResponse.redirect(backTo('?erro=tiktok')))
  }
}

function clearCookie(response: NextResponse): NextResponse {
  response.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
