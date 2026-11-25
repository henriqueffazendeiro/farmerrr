import 'server-only'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify, validateSlug } from '@/lib/slug'
import { normalizeStreamChannel } from '@/lib/streams/public-input'
import { PUBLIC_STREAM_MARKER, readPublicChannel, type PublicChannelSnapshot } from '@/lib/streams/public-provider'
import { syncStreamConnection } from '@/lib/streams/sync'
import { keepOnlyConnection } from '@/lib/streams/connections'
import { onboardingSchema, type OnboardingInput } from './schema'

export type CreatedPage = { error?: string; slug?: string; notice?: string }

/** Página já existente deste utilizador (o assistente não cria uma segunda). */
export async function existingPageSlug(userId: string) {
  const db = await createClient()
  const { data: creator } = await db.from('creators').select('id').eq('owner_id', userId).order('created_at').limit(1).maybeSingle()
  if (!creator) return null
  const { data } = await db.from('leaderboards').select('slug').eq('creator_id', creator.id).maybeSingle()
  return data?.slug ?? null
}

/**
 * Cria o perfil, a ligação ao canal, a página e os prémios a partir das respostas do assistente.
 * Chamado depois do pagamento (ou logo, se a faturação estiver desligada). Idempotente: se a página já existir, devolve-a.
 */
export async function createOnboardingPage(user: { id: string }, values: OnboardingInput, snapshot?: PublicChannelSnapshot): Promise<CreatedPage> {
  const url = normalizeStreamChannel(values.platform, values.channel)
  const db = await createClient()
  const admin = createAdminClient()
  const { data: existingCreator, error: creatorError } = await db.from('creators').select('*').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle()
  if (creatorError) throw creatorError
  let creator = existingCreator
  if (creator) {
    const { data: existing, error } = await db.from('leaderboards').select('slug').eq('creator_id', creator.id).maybeSingle()
    if (error) throw error
    if (existing) return { slug: existing.slug }
  }
  // O canal já foi validado no fim do assistente; volta a ler-se se a página for criada mais tarde (depois do pagamento).
  snapshot ??= await readPublicChannel(values.platform, url, { history: true })
  const identity = { channel_id: snapshot.channel_id, channel_name: snapshot.channel_name, channel_url: snapshot.channel_url }
  if (!creator) {
    const { data: profile } = await db.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    const name = (profile?.display_name || identity.channel_name || 'A minha página').slice(0, 60)
    const base = slugify(name).slice(0, 24) || 'criador'
    const creatorHandle = `${base}-${user.id.replaceAll('-', '').slice(0, 10)}`
    const { data, error } = await db.from('creators').insert({ owner_id: user.id, name, handle: creatorHandle }).select('*').single()
    if (error && error.code !== '23505') throw error
    creator = data
    if (!creator) {
      const retry = await db.from('creators').select('*').eq('owner_id', user.id).eq('handle', creatorHandle).maybeSingle()
      if (retry.error || !retry.data) throw new Error('Não foi possível criar o perfil.')
      creator = retry.data
    }
  }
  const { data: previous, error: lookupError } = await admin.from('stream_connections').select('id,channel_id')
    .eq('creator_id', creator.id).eq('platform', values.platform).maybeSingle()
  if (lookupError) throw lookupError
  if (previous && previous.channel_id !== identity.channel_id) return { error: 'Já tens outra conta ligada nesta plataforma. Usa a conta que ligaste anteriormente.' }
  let connectionId = previous?.id
  if (!connectionId) {
    const { data, error } = await admin.from('stream_connections').insert({ creator_id: creator.id, platform: values.platform, ...identity,
      access_token_enc: PUBLIC_STREAM_MARKER, refresh_token_enc: null,
      expires_at: '9999-01-01T00:00:00Z', status: 'connected',
    }).select('id').single()
    if (error || !data) return { error: error?.code === '23505' ? 'Esta conta já está ligada a uma página. Confirma a conta e tenta novamente.' : 'Não foi possível guardar a conta. Tenta novamente.' }
    connectionId = data.id
  }
  await keepOnlyConnection(creator.id, connectionId)
  let notice: string | undefined
  try { await syncStreamConnection(connectionId, snapshot) }
  catch { notice = 'A conta ficou guardada. A consulta das lives será repetida automaticamente.' }
  const base = slugify(creator.name)
  const preferred = validateSlug(base) ? creator.handle : base
  let slug: string | undefined
  let createdLeaderboardId: string | undefined
  for (const candidate of [preferred, `${preferred.slice(0, 27)}-${creator.id.slice(0, 8)}`]) {
    const { data, error } = await db.from('leaderboards').insert({ creator_id: creator.id, name: creator.name,
      slug: candidate, starts_at: values.startsAt, ends_at: values.endsAt, period_mode: values.period,
      timezone: values.timezone, status: 'active',
    }).select('id,slug').single()
    if (data) { slug = data.slug; createdLeaderboardId = data.id; break }
    if (error?.code !== '23505') throw error
    const existing = await db.from('leaderboards').select('slug').eq('creator_id', creator.id).maybeSingle()
    if (existing.data) { slug = existing.data.slug; break }
  }
  if (!slug) return { error: 'Não foi possível criar o endereço da página. Tenta novamente.' }
  if (createdLeaderboardId && values.rewards.length) {
    const { error: rewardsError } = await db.from('rewards').insert(values.rewards.map(reward => ({
      leaderboard_id: createdLeaderboardId!, position: reward.position,
      amount_cents: reward.amountCents, currency: 'EUR',
    })))
    if (rewardsError) notice = [notice, 'A página foi criada, mas não foi possível guardar os prémios. Adiciona-os nas definições da tua página.'].filter(Boolean).join(' ')
  }
  revalidatePath('/dashboard', 'layout')
  revalidatePath(`/${slug}`)
  return { slug, notice }
}

// ─── Respostas do assistente guardadas no Checkout do Stripe até ao pagamento ───
// (metadados do Stripe: no máximo 500 caracteres por valor; os prémios vão num campo à parte)

export function encodeOnboarding(values: OnboardingInput) {
  const { rewards, ...rest } = values
  return { onboarding: JSON.stringify(rest), onboarding_rewards: rewards.map(reward => `${reward.position}:${reward.amountCents}`).join(',') }
}

export function decodeOnboarding(metadata: Record<string, string> | null | undefined): OnboardingInput | null {
  if (!metadata?.onboarding) return null
  try {
    const rewards = (metadata.onboarding_rewards || '').split(',').filter(Boolean).map(item => {
      const [position, amountCents] = item.split(':').map(Number)
      return { position, amountCents }
    })
    const parsed = onboardingSchema.safeParse({ ...JSON.parse(metadata.onboarding), rewards })
    return parsed.success ? parsed.data : null
  } catch { return null }
}
