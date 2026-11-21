import { after, NextResponse, type NextRequest } from 'next/server'
import { runQueue } from '@/lib/sync/queue'
import { isAuthorizedCron } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Consome a fila de sincronização. Chamado pelo cron de 5 em 5 minutos. */
async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }

  const requested = Number(new URL(request.url).searchParams.get('limit') ?? 5)
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.floor(requested), 1), 10) : 5

  // External schedulers can acknowledge immediately while Next/Vercel keeps
  // the server invocation alive. Actual results remain in sync_jobs.
  if (new URL(request.url).searchParams.get('background') === '1') {
    after(async () => {
      try { await runQueue(limit) }
      catch (error) { console.error('[farmerrr] sincronização em background falhou', error) }
    })
    return NextResponse.json({ ok: true, accepted: true }, { status: 202 })
  }

  try {
    const report = await runQueue(limit)
    return NextResponse.json({ ok: true, ...report })
  } catch (error) {
    console.error('[farmerrr] cron/sync falhou', error)
    return NextResponse.json({ ok: false, error: 'falha na sincronizacao' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
