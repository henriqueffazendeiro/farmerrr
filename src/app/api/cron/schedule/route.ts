import { NextResponse, type NextRequest } from 'next/server'
import { scheduleJobs } from '@/lib/sync/queue'
import { isAuthorizedCron } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Enche a fila com o que está em atraso. Chamado de 15 em 15 minutos. */
async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }

  try {
    const report = await scheduleJobs()
    return NextResponse.json({ ok: true, ...report })
  } catch (error) {
    console.error('[farmerrr] cron/schedule falhou', error)
    return NextResponse.json({ ok: false, error: 'falha no agendamento' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
