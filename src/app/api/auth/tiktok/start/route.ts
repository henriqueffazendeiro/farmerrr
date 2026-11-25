import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProvider, tiktokConnectionAvailable } from '@/lib/providers/registry'
import { STATE_COOKIE, createState } from '@/lib/auth/oauth-state'
import { serverEnv } from '@/lib/config/env'

export const dynamic = 'force-dynamic'

/** Passo 1 do OAuth: prepara o `state` e envia o clipper para o TikTok. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const slug = searchParams.get('lb')
  const recap = searchParams.get('recap') === '1'
  const month = searchParams.get('mes') ?? ''

  if (!slug) return NextResponse.redirect(`${origin}/`)

  // O cookie de `state` (e depois a sessão) só existe no host onde o fluxo começa,
  // por isso o fluxo tem de começar no mesmo host do redirect URI registado no TikTok.
  const callbackOrigin = (() => {
    const uri = serverEnv().TIKTOK_REDIRECT_URI
    try { return uri ? new URL(uri).origin : null } catch { return null }
  })()
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (callbackOrigin && callbackOrigin !== origin && !isLocal) {
    const url = new URL(request.url)
    return NextResponse.redirect(`${callbackOrigin}${url.pathname}${url.search}`)
  }

  const admin = createAdminClient()
  const { data: leaderboard } = await admin
    .from('leaderboards')
    .select('id, slug, status')
    .eq('slug', slug)
    .maybeSingle()

  if (!leaderboard) return NextResponse.redirect(`${origin}/`)
  if (!tiktokConnectionAvailable()) return NextResponse.redirect(`${origin}/join/${leaderboard.slug}?erro=indisponivel`)
  if (leaderboard.status !== 'active' && !(recap && leaderboard.status === 'ended')) {
    return NextResponse.redirect(`${origin}/join/${leaderboard.slug}?erro=fechado`)
  }

  const provider = getProvider('tiktok')
  const { state, nonce } = createState(leaderboard.id, leaderboard.slug, recap,
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined)

  // O provider simulado devolve um caminho relativo; o real, um URL absoluto.
  const target = provider.getAuthUrl(state)
  const destination = target.startsWith('http') ? target : `${origin}${target}`

  const response = NextResponse.redirect(destination)
  response.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https'),
    path: '/',
    maxAge: 600,
  })

  return response
}
