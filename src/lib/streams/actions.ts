'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getMyCreator } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncStreamConnection } from './sync'

export async function checkStreamNow(form: FormData) {
  const creator = await getMyCreator()
  if (!creator) redirect('/entrar')
  const id = String(form.get('connectionId') || '')
  const db = createAdminClient()
  const { data } = await db.from('stream_connections').select('id,last_checked_at')
    .eq('id', id).eq('creator_id', creator.id).maybeSingle()
  if (!data) redirect('/dashboard/conta?streams=error')
  if (data.last_checked_at && Date.now() - new Date(data.last_checked_at).getTime() < 60_000) redirect('/dashboard/conta?streams=recent')
  try { await syncStreamConnection(id) } catch { redirect('/dashboard/conta?streams=error') }
  revalidatePath('/dashboard/conta')
  revalidatePath('/', 'layout')
  redirect('/dashboard/conta?streams=checked')
}

export async function disconnectStream(form: FormData) {
  const creator = await getMyCreator()
  if (!creator) redirect('/entrar')
  const id = String(form.get('connectionId') || '')
  const db = createAdminClient()
  const { data, error } = await db.from('stream_connections').delete().eq('id', id).eq('creator_id', creator.id)
    .lt('sync_locked_until', new Date().toISOString()).select('platform,channel_id').maybeSingle()
  if (error || !data) redirect('/dashboard/conta?streams=busy')
  const { error: endError } = await db.from('creator_lives').update({ is_live: false, ended_at: new Date().toISOString() })
    .eq('creator_id', creator.id).eq('platform', data.platform).eq('channel_id', data.channel_id).eq('is_live', true)
  if (endError) redirect('/dashboard/conta?streams=error')
  revalidatePath('/', 'layout')
  redirect('/dashboard/conta?streams=disconnected')
}
