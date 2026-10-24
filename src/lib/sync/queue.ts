import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { syncAccount } from '@/lib/sync/account'
import { ProviderError } from '@/lib/providers/types'
import type { SyncJob } from '@/lib/db/types'

const MAX_ATTEMPTS = 5

/** Espera crescente entre tentativas: 2, 4, 8, 16 minutos. */
function backoffMinutes(attempts: number): number {
  return Math.min(2 ** attempts, 16)
}

/** Reclama trabalhos pendentes e marca-os como em execução. */
async function claim(limit: number): Promise<SyncJob[]> {
  const admin = createAdminClient()

  // Recover jobs abandoned by an interrupted worker after its account lease expires.
  const { error: recoveryError } = await admin.from('sync_jobs').update({ status: 'pending', started_at: null })
    .eq('status', 'running').lt('started_at', new Date(Date.now() - 10 * 60_000).toISOString())
  if (recoveryError) throw recoveryError

  const { data: candidates } = await admin
    .from('sync_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (!candidates || candidates.length === 0) return []

  const { data: claimed } = await admin
    .from('sync_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .in(
      'id',
      candidates.map((job) => job.id),
    )
    .eq('status', 'pending') // não rouba trabalhos que outra execução já apanhou
    .select('*')

  return claimed ?? []
}

export type QueueReport = {
  processed: number
  failed: number
  discovered: number
  refreshed: number
}

/** Consome a fila. Pensado para correr dentro do limite de tempo do cron. */
export async function runQueue(limit = 10): Promise<QueueReport> {
  const admin = createAdminClient()
  const jobs = await claim(limit)

  const report: QueueReport = { processed: 0, failed: 0, discovered: 0, refreshed: 0 }

  for (const job of jobs) {
    try {
      const result = await syncAccount(job.social_account_id, job.kind)

      report.processed += 1
      report.discovered += result.discovered
      report.refreshed += result.refreshed

      await admin
        .from('sync_jobs')
        .update({ status: 'done', finished_at: new Date().toISOString(), last_error: null })
        .eq('id', job.id)
    } catch (error) {
      report.failed += 1

      const attempts = job.attempts + 1
      const message = error instanceof Error ? error.message : String(error)

      // Falha de autorização não se resolve com tentativas: a conta precisa
      // de ser religada pelo clipper.
      const permanent =
        (error instanceof ProviderError && error.kind === 'auth') || attempts >= MAX_ATTEMPTS

      await admin
        .from('sync_jobs')
        .update({
          status: permanent ? 'error' : 'pending',
          attempts,
          last_error: message.slice(0, 500),
          finished_at: permanent ? new Date().toISOString() : null,
          started_at: null,
          scheduled_for: permanent
            ? job.scheduled_for
            : new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString(),
        })
        .eq('id', job.id)
    }
  }

  return report
}

export type ScheduleReport = { accounts: number; enqueued: number }

/**
 * Enche a fila com o que está em atraso.
 *
 * Só toca em contas ligadas a competições a decorrer — quando uma competição
 * termina, as contas dela deixam de custar chamadas à API.
 */
export async function scheduleJobs(): Promise<ScheduleReport> {
  const admin = createAdminClient()

  const { data: activeBoards } = await admin
    .from('leaderboards')
    .select('id')
    .eq('status', 'active')

  if (!activeBoards || activeBoards.length === 0) return { accounts: 0, enqueued: 0 }

  const { data: participants } = await admin
    .from('leaderboard_participants')
    .select('clipper_profile_id')
    .eq('status', 'active')
    .in(
      'leaderboard_id',
      activeBoards.map((b) => b.id),
    )

  const profileIds = [...new Set((participants ?? []).map((p) => p.clipper_profile_id))]
  if (profileIds.length === 0) return { accounts: 0, enqueued: 0 }

  const { data: accounts } = await admin
    .from('social_accounts')
    .select('id, last_discovered_at')
    .eq('status', 'connected')
    .in('clipper_profile_id', profileIds)

  if (!accounts || accounts.length === 0) return { accounts: 0, enqueued: 0 }

  const now = Date.now()
  let enqueued = 0

  for (const account of accounts) {
    const last = account.last_discovered_at ? new Date(account.last_discovered_at).getTime() : 0
    const minutesSince = (now - last) / 60_000

    // Descoberta de clips novos: de 30 em 30 minutos.
    if (minutesSince >= 30) {
      const { data } = await admin.rpc('enqueue_sync_job', {
        p_social_account_id: account.id,
        p_kind: 'discover',
        p_priority: 50,
      })
      if (data) enqueued += 1
    }

    // Atualização de métricas: a cadência fina (1h / 6h / 24h por idade do
    // vídeo) é decidida dentro de syncAccount; aqui só damos a oportunidade.
    const { data: refreshJob } = await admin.rpc('enqueue_sync_job', {
      p_social_account_id: account.id,
      p_kind: 'refresh',
      p_priority: 100,
    })
    if (refreshJob) enqueued += 1
  }

  return { accounts: accounts.length, enqueued }
}
