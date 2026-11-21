import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncStreamConnection } from '@/lib/streams/sync'
import { streamPlatforms } from '@/lib/streams/model'
import { isPublicMarker, readLiveBatch } from '@/lib/streams/public-provider'
import { webhooksAvailable } from '@/lib/streams/webhooks'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Corre tarefas com no máximo `limit` em simultâneo. */
async function pool<T>(items: T[], limit: number, run: (item: T) => Promise<unknown>) {
  const results: PromiseSettledResult<unknown>[] = []
  for (let i = 0; i < items.length; i += limit) results.push(...await Promise.allSettled(items.slice(i, i + limit).map(run)))
  return results
}

/**
 * Rede de segurança dos avisos em tempo real (webhooks): verifica todos os canais em grupo.
 * Com webhooks ativos chega de 10 em 10 minutos; sem eles (localhost), de 5 em 5.
 * Twitch: 100 canais por pedido; Kick: 50; YouTube: ~1 unidade de quota por canal.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const interval = (webhooksAvailable() ? 10 : 5) * 60_000
  const now = new Date()
  const { data, error } = await createAdminClient().from('stream_connections')
    .select('id,platform,channel_id,channel_name,channel_url,access_token_enc,last_checked_at')
    .eq('status', 'connected').lt('sync_locked_until', now.toISOString())
    .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(now.getTime() - interval + 30_000).toISOString()}`)
    .order('last_checked_at', { ascending: true, nullsFirst: true }).limit(2000)
  if (error) return NextResponse.json({ error: 'Não foi possível consultar os canais.' }, { status: 500 })

  const today = now.toISOString().slice(0, 10)
  // Leitura individual: primeira verificação do dia (importa lives passadas e renova os webhooks),
  // canais ainda sem ID real, e ligações OAuth antigas.
  const individual = data.filter(row => !isPublicMarker(row.access_token_enc) || row.channel_id.startsWith('pending:')
    || !row.last_checked_at || row.last_checked_at.slice(0, 10) !== today)
  const batched = data.filter(row => !individual.includes(row))

  let failed = 0
  for (const platform of streamPlatforms) {
    const rows = batched.filter(row => row.platform === platform)
    if (!rows.length) continue
    let lives: Awaited<ReturnType<typeof readLiveBatch>>
    // Uma falha da API nunca é tratada como "offline": estes canais ficam para a próxima.
    try { lives = await readLiveBatch(platform, rows) } catch { failed += rows.length; continue }
    const results = await pool(rows, 10, row => syncStreamConnection(row.id, { channel_id: row.channel_id, channel_name: row.channel_name,
      channel_url: row.channel_url, streams: lives.get(row.channel_id) ?? [] }))
    failed += results.filter(result => result.status === 'rejected').length
  }
  const results = await pool(individual.slice(0, 40), 5, row => syncStreamConnection(row.id))
  failed += results.filter(result => result.status === 'rejected').length

  return NextResponse.json({ checked: batched.length + Math.min(individual.length, 40), batched: batched.length, failed }, { status: failed ? 502 : 200 })
}
