import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { seedAvailable, seedLeaderboard } from '@/lib/dev/seed'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Enche uma competição com clipfarmers simulados:
 *
 *   GET /api/dev/seed?lb=<slug>&n=8
 *
 * O mesmo que o botão "Encher com clipfarmers de teste" no dashboard, para
 * quem prefere a linha de comandos. Só fora de produção e só em modo mock.
 */
export async function GET(request: NextRequest) {
  if (!seedAvailable()) {
    return NextResponse.json(
      { error: 'só corre fora de produção e com SOCIAL_PROVIDER=mock' },
      { status: 403 },
    )
  }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('lb')
  const count = Number(searchParams.get('n') ?? 8)

  if (!slug) {
    return NextResponse.json(
      { error: 'falta o parâmetro lb (o endereço do leaderboard)' },
      { status: 400 },
    )
  }

  try {
    const result = await seedLeaderboard(slug, count)
    revalidateTag(`lb:${result.slug}`)
    return NextResponse.json({ ok: true, url: `/${result.slug}`, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'falhou'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
