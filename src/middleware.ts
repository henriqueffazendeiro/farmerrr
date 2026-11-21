import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { publicEnv, supabaseConfigured } from '@/lib/config/env'

/**
 * Renova a sessão do streamer em cada pedido e protege /dashboard.
 * Se o Supabase ainda não estiver configurado, não faz nada — a parte
 * pública do site continua a funcionar.
 */
export async function middleware(request: NextRequest) {
  if (!supabaseConfigured) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // getUser() valida o token no servidor — getSession() não valida.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (!user && path.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/entrar'
    url.searchParams.set('seguinte', path)
    return NextResponse.redirect(url)
  }

  if (user && (path === '/entrar' || path === '/registar')) {
    // Quem já tem sessão salta o formulário, mas mantém o destino pedido.
    const seguinte = request.nextUrl.searchParams.get('seguinte')
    const target = seguinte?.startsWith('/') ? seguinte : '/dashboard'
    const url = request.nextUrl.clone()
    url.search = ''
    // "Começar" aponta para /dashboard/novo; quem já tem página vai direto
    // para ela, sem renderizar /dashboard/novo só para voltar a redirecionar.
    url.pathname = target === '/dashboard/novo' ? (await myLeaderboardPath(supabase, user.id)) ?? target : target
    return withCookies(NextResponse.redirect(url), response)
  }

  if (user && path === '/dashboard/novo' && request.nextUrl.searchParams.get('preview') !== '1') {
    const leaderboardPath = await myLeaderboardPath(supabase, user.id)
    if (leaderboardPath) {
      const url = request.nextUrl.clone()
      url.pathname = leaderboardPath
      url.search = ''
      return withCookies(NextResponse.redirect(url), response)
    }
  }

  return response
}

/** Mesma escolha que getMyCreator + getMyLeaderboard: criador mais antigo, ranking mais recente. */
async function myLeaderboardPath(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data: creator } = await supabase.from('creators').select('id')
    .eq('owner_id', userId).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!creator) return null
  const { data: leaderboard } = await supabase.from('leaderboards').select('slug')
    .eq('creator_id', creator.id).order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(1).maybeSingle()
  return leaderboard?.slug ? `/${leaderboard.slug}` : null
}

/** Um redirect novo perderia os cookies de sessão renovados pelo getUser(). */
function withCookies(redirect: NextResponse, from: NextResponse) {
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}

export const config = {
  matcher: [
    /*
     * Tudo menos ficheiros estáticos e imagens.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
