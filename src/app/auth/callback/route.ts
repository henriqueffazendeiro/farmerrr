import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Destino do link de confirmação de email e do login com Google (Supabase Auth). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requested = searchParams.get('next') ?? '/dashboard'
  // "//site.com" também começa por "/" — sem isto seria um redirect para fora do site.
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link-invalido`)
}
