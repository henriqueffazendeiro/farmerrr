'use server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClipperMembership } from './session'

export async function requestClipperSync(form: FormData) {
  const slug = String(form.get('slug') || '')
  const member = await getClipperMembership(slug)
  if (!member) redirect(`/join/${encodeURIComponent(slug)}`)
  const destination = `/join/${encodeURIComponent(slug)}/conta`
  if (!member.account || member.account.status !== 'connected' || member.participant.status !== 'active'
    || member.board.status !== 'active' || (member.board.ends_at && new Date(member.board.ends_at).getTime() <= Date.now())) redirect(`${destination}?estado=indisponivel`)
  if (member.account.last_synced_at && Date.now() - new Date(member.account.last_synced_at).getTime() < 5 * 60_000) redirect(`${destination}?estado=recente`)
  const { error } = await createAdminClient().rpc('enqueue_sync_job', { p_social_account_id: member.account.id, p_kind: 'discover', p_priority: 10 })
  redirect(`${destination}?estado=${error ? 'erro' : 'fila'}`)
}
