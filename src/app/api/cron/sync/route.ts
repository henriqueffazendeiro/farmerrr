import { NextResponse, type NextRequest } from 'next/server'
import { runQueue } from '@/lib/sync/queue'
import { isAuthorizedCron } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Consome a fila de sincronização. Chamado pelo cron de 5 em 5 minutos. */
async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }

  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 10)

  try {
    const report = await runQueue(Math.min(Math.max(limit, 1), 50))
    return NextResponse.json({ ok: true, ...report })
  } catch (error) {
    console.error('[farmerrr] cron/sync falhou', error)
    return NextResponse.json({ ok: false, error: 'falha na sincronizacao' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
