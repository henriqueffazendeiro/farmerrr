import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncStreamConnection } from '@/lib/streams/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data, error } = await createAdminClient().from('stream_connections').select('id')
    .eq('status', 'connected').lt('sync_locked_until', new Date().toISOString())
    .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(Date.now() - 55_000).toISOString()}`)
    .order('last_checked_at', { ascending: true, nullsFirst: true }).limit(10)
  if (error) return NextResponse.json({ error: 'Não foi possível consultar os canais.' }, { status: 500 })
  const results = await Promise.allSettled(data.map(row => syncStreamConnection(row.id)))
  const failed = results.filter(result => result.status === 'rejected').length
  return NextResponse.json({ checked: results.length, failed }, { status: failed ? 502 : 200 })
}
