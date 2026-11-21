import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CLIPPER_COOKIE, makeClipperSession } from '@/lib/recap/session'

export const dynamic = 'force-dynamic'

/**
 * Só em desenvolvimento: entra como um clipper que já participa numa competição, sem passar pelo TikTok
 * (o login do TikTok volta sempre ao domínio de produção, por isso não funciona em localhost).
 *
 *   GET /api/dev/clipper-session?lb=<slug>        → o primeiro participante ativo
 *   GET /api/dev/clipper-session?lb=<slug>&p=<id> → um participante concreto
 *
 * Só cria o cookie de sessão do clipper; não escreve nada na base de dados.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'Só em desenvolvimento.' }, { status: 404 })
  const slug = request.nextUrl.searchParams.get('lb') || ''
  const wanted = request.nextUrl.searchParams.get('p')
  const db = createAdminClient()
  const { data: board } = await db.from('leaderboards').select('id').eq('slug', slug).maybeSingle()
  if (!board) return NextResponse.json({ error: `Competição "${slug}" não encontrada.` }, { status: 404 })
  let query = db.from('leaderboard_participants').select('id').eq('leaderboard_id', board.id).eq('status', 'active')
  if (wanted) query = query.eq('id', wanted)
  const { data: participant } = await query.order('joined_at').limit(1).maybeSingle()
  if (!participant) return NextResponse.json({ error: 'Esta competição não tem clippers ativos.' }, { status: 404 })
  const response = NextResponse.redirect(new URL(`/${encodeURIComponent(slug)}`, request.url))
  response.cookies.set(CLIPPER_COOKIE, makeClipperSession(participant.id), { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 7 * 86400 })
  return response
}
