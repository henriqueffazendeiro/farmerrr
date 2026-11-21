'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getMyCreator } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncStreamConnection } from './sync'
import { removeLiveWebhooks } from './webhooks'

export async function checkStreamNow(form: FormData) {
  const creator = await getMyCreator()
  if (!creator) redirect('/entrar')
  const id = String(form.get('connectionId') || '')
  const db = createAdminClient()
  const { data } = await db.from('stream_connections').select('id,last_checked_at')
    .eq('id', id).eq('creator_id', creator.id).maybeSingle()
  if (!data) redirect('/dashboard?streams=error')
  if (data.last_checked_at && Date.now() - new Date(data.last_checked_at).getTime() < 60_000) redirect('/dashboard?streams=recent')
  let skipped = false
  try { skipped = 'skipped' in await syncStreamConnection(id) } catch { redirect('/dashboard?streams=error') }
  if (skipped) redirect('/dashboard?streams=busy')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/', 'layout')
  redirect('/dashboard?streams=checked')
}

export async function disconnectStream(form: FormData) {
  const creator = await getMyCreator()
  if (!creator) redirect('/entrar')
  const id = String(form.get('connectionId') || '')
  const db = createAdminClient()
  const { data, error } = await db.from('stream_connections').delete().eq('id', id).eq('creator_id', creator.id)
    .lt('sync_locked_until', new Date().toISOString()).select('platform,channel_id').maybeSingle()
  if (error) redirect('/dashboard?streams=error')
  if (!data) {
    const { data: remaining, error: readError } = await db.from('stream_connections').select('id')
      .eq('id', id).eq('creator_id', creator.id).maybeSingle()
    if (readError) redirect('/dashboard?streams=error')
    if (remaining) redirect('/dashboard?streams=busy')
    revalidatePath('/', 'layout')
    redirect('/dashboard/conta?streams=disconnected')
  }
  // Deixa de receber avisos deste canal, se mais nenhum perfil o tiver ligado.
  const { count: others } = await db.from('stream_connections').select('id', { count: 'exact', head: true })
    .eq('platform', data.platform).eq('channel_id', data.channel_id)
  if (others === 0) await removeLiveWebhooks(data).catch(() => undefined)
  const { error: endError } = await db.from('creator_lives').update({ is_live: false, ended_at: new Date().toISOString() })
    .eq('creator_id', creator.id).eq('platform', data.platform).eq('channel_id', data.channel_id).eq('is_live', true)
  if (endError) redirect('/dashboard?streams=error')
  revalidatePath('/', 'layout')
  redirect('/dashboard?streams=disconnected')
}
