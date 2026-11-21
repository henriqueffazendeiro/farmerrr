import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * O separador que ficou aberto à espera da confirmação de email pergunta aqui
 * se a sessão já existe — o link do email abre noutro separador, mas a cookie
 * é partilhada pelos dois.
 */
export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json({ pronto: Boolean(user) }, { headers: { 'Cache-Control': 'no-store' } })
}
