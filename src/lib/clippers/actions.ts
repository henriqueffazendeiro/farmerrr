'use server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CLIPPER_COOKIE } from '@/lib/recap/session'
import { getClipperMembership } from './session'

export type DiscordState = { ok?: boolean; error?: string }

/** Nome de utilizador do Discord (novo formato, ou o antigo nome#1234). Vazio apaga. */
const DISCORD = /^[A-Za-z0-9_.]{2,32}(#\d{4})?$/

export async function saveClipperDiscordAction(_previous: DiscordState, form: FormData): Promise<DiscordState> {
  const member = await getClipperMembership(String(form.get('slug') || ''))
  if (!member) return { error: 'A sessão terminou. Entre novamente com o TikTok.' }
  const discord = String(form.get('discord') ?? '').trim().replace(/^@/, '')
  if (discord && !DISCORD.test(discord)) return { error: 'Nome de utilizador do Discord inválido.' }
  const { error } = await createAdminClient().from('clipper_profiles')
    .update({ discord: discord || null }).eq('id', member.participant.clipper_profile_id)
  return error ? { error: 'Não foi possível guardar. Tente novamente.' } : { ok: true }
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Email do clipper (privado): para o avisar quando tiver um prémio para levantar. Vazio apaga. */
export async function saveClipperEmailAction(_previous: DiscordState, form: FormData): Promise<DiscordState> {
  const member = await getClipperMembership(String(form.get('slug') || ''))
  if (!member) return { error: 'A sessão terminou. Entre novamente com o TikTok.' }
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (email && (email.length > 254 || !EMAIL.test(email))) return { error: 'Email inválido.' }
  const { error } = await createAdminClient().from('clipper_profiles')
    .update({ email: email || null }).eq('id', member.participant.clipper_profile_id)
  return error ? { error: 'Não foi possível guardar. Tente novamente.' } : { ok: true }
}

/** "Terminar sessão" do clipper: apaga a sessão e volta à página da competição (com "Participar"). */
export async function clipperSignOutAction(form: FormData) {
  const slug = String(form.get('slug') || '')
  ;(await cookies()).delete(CLIPPER_COOKIE)
  revalidatePath(`/${slug}`)
  redirect(slug ? `/${encodeURIComponent(slug)}` : '/')
}

export async function requestClipperSync(form: FormData) {
  const slug = String(form.get('slug') || '')
  const member = await getClipperMembership(slug)
  if (!member) redirect(`/join/${encodeURIComponent(slug)}`)
  const destination = `/join/${encodeURIComponent(slug)}/conta`
  if (!member.account || member.account.status !== 'connected' || member.participant.status !== 'active'
    || member.board.status !== 'active' || (member.board.ends_at && new Date(member.board.ends_at).getTime() <= Date.now())) redirect(`${destination}?estado=indisponivel`)
  const interval = 5 * 60_000
  if (member.account.last_synced_at && Date.now() - new Date(member.account.last_synced_at).getTime() < interval) redirect(`${destination}?estado=recente`)
  const { error } = await createAdminClient().rpc('enqueue_sync_job', { p_social_account_id: member.account.id, p_kind: 'discover', p_priority: 10 })
  redirect(`${destination}?estado=${error ? 'erro' : 'fila'}`)
}
