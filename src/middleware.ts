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
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Tudo menos ficheiros estáticos e imagens.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
