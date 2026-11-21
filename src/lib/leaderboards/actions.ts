'use server'

import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getMyCreator, getMyLeaderboard, getOwnedLeaderboard } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify, validateSlug, slugProblemMessage } from '@/lib/slug'
import { MAX_REWARD_POSITIONS, REWARD_POSITIONS } from './reward-positions'

export type LeaderboardState = { error?: string; success?: boolean; slug?: string }

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((v) => (v ? v : null))

const isoDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Data inválida.')

const schema = z.object({
  name: z.string().trim().min(2, 'Dá um nome à competição.').max(80),
  slug: z.string().trim().min(3).max(40),
  description: optionalText,
  rules: optionalText,
  quote: optionalText,
  quoteAuthor: optionalText,
  announcement: optionalText,
  startsAt: isoDate,
  endsAt: isoDate,
  timezone: z.string().trim().min(1).max(60).default('Europe/Lisbon'),
})

const rewardSchema = z.object({
  position: z.number().int().min(1).max(MAX_REWARD_POSITIONS),
  label: z.string().trim().max(120).nullable(),
  amountCents: z.number().int().min(0).nullable(),
})

/** Lê os prémios do formulário: reward-1-label, reward-1-amount, … */
function readRewards(formData: FormData) {
  const rewards: z.infer<typeof rewardSchema>[] = []

  for (const position of REWARD_POSITIONS) {
    const label = String(formData.get(`reward-${position}-label`) ?? '').trim()
    const rawAmount = String(formData.get(`reward-${position}-amount`) ?? '').trim()

    if (!label && !rawAmount) continue

    const euros = rawAmount ? Number(rawAmount.replace(',', '.')) : NaN
    rewards.push({
      position,
      label: label || null,
      amountCents: Number.isFinite(euros) ? Math.round(euros * 100) : null,
    })
  }

  return rewards
}

export async function createLeaderboardAction(
  _prev: LeaderboardState,
  formData: FormData,
): Promise<LeaderboardState> {
  const creator = await getMyCreator()
  if (!creator) redirect('/dashboard/inicio')
  const existing = await getMyLeaderboard(creator.id)
  if (existing) redirect(`/dashboard/l/${existing.id}/definicoes`)

  const parsed = schema.safeParse({
    name: formData.get('name'),
    slug: slugify(String(formData.get('name') ?? '')),
    description: formData.get('description') ?? undefined,
    rules: formData.get('rules') ?? undefined,
    quote: formData.get('quote') ?? undefined,
    quoteAuthor: formData.get('quoteAuthor') ?? undefined,
    announcement: formData.get('announcement') ?? undefined,
    startsAt: formData.get('startsAt') ?? undefined,
    endsAt: formData.get('endsAt') ?? undefined,
    timezone: formData.get('timezone') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const problem = validateSlug(parsed.data.slug)
  if (problem) return { error: slugProblemMessage(problem)! }

  const startsAt = parsed.data.startsAt ?? new Date().toISOString()
  if (parsed.data.endsAt && Date.parse(parsed.data.endsAt) <= Date.parse(startsAt)) {
    return { error: 'A data de fim tem de ser depois da data de início.' }
  }

  const supabase = await createClient()

  const { data: leaderboard, error } = await supabase
    .from('leaderboards')
    .insert({
      creator_id: creator.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      blur_rewards: formData.get('blurRewards') === 'true',
      description: parsed.data.description,
      rules: parsed.data.rules,
      quote: parsed.data.quote,
      quote_author: parsed.data.quoteAuthor ?? creator.name,
      announcement: parsed.data.announcement,
      starts_at: startsAt,
      ends_at: parsed.data.endsAt,
      event_at: null,
      period_mode: 'monthly',
      timezone: parsed.data.timezone,
      status: 'active',
    })
    .select('id, slug')
    .single()

  if (error || !leaderboard) {
    if (error?.code === '23505') {
      const existing = await getMyLeaderboard(creator.id)
      if (existing) redirect(`/dashboard/l/${existing.id}/definicoes`)
      return { error: `O endereço "${parsed.data.slug}" já está ocupado. Escolhe outro nome para a página.` }
    }
    if (error?.code === '23514') {
      return { error: error.message.replace(/^.*?:\s*/, '') }
    }
    return { error: 'Não foi possível criar o leaderboard. Tenta novamente.' }
  }

  const rewards = readRewards(formData)
  if (rewards.length > 0) {
    await supabase.from('rewards').insert(
      rewards.map((r) => ({
        leaderboard_id: leaderboard.id,
        position: r.position,
        label: r.label,
        amount_cents: r.amountCents,
      })),
    )
  }

  revalidatePath('/dashboard')
  redirect(`/dashboard/l/${leaderboard.id}/definicoes`)
}

export async function updateLeaderboardAction(
  _prev: LeaderboardState,
  formData: FormData,
): Promise<LeaderboardState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Leaderboard não encontrado.' }

  const parsed = schema.safeParse({
    name: formData.get('name'),
    slug: slugify(String(formData.get('name') ?? '')),
    description: formData.get('description') ?? undefined,
    rules: formData.get('rules') ?? undefined,
    quote: formData.get('quote') ?? undefined,
    quoteAuthor: formData.get('quoteAuthor') ?? undefined,
    announcement: formData.get('announcement') ?? undefined,
    startsAt: formData.get('startsAt') ?? undefined,
    endsAt: formData.get('endsAt') ?? undefined,
    timezone: formData.get('timezone') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  if (parsed.data.slug) {
    const problem = validateSlug(parsed.data.slug)
    if (problem) return { error: slugProblemMessage(problem)! }
  }

  const supabase = await createClient()
  // Só o dono: a leitura pública da RLS devolvia a competição a qualquer pessoa.
  const current = await getOwnedLeaderboard(id)
  if (!current) return { error: 'Não foi possível carregar as definições. Atualiza a página e tenta novamente.' }
  const supportsBlur = Object.prototype.hasOwnProperty.call(current, 'blur_rewards')
  if (!supportsBlur && formData.get('blurRewards') === 'true') {
    return { error: 'Ainda não é possível ocultar as quantias. Seleciona Mostrar quantia para guardar as restantes alterações.' }
  }

  const { error } = await supabase
    .from('leaderboards')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      blur_rewards: supportsBlur && formData.has('blurRewards') ? formData.get('blurRewards') === 'true' : undefined,
      description: parsed.data.description,
      rules: formData.has('rules') ? parsed.data.rules : undefined,
      quote: formData.has('quote') ? parsed.data.quote : undefined,
      quote_author: formData.has('quoteAuthor') ? parsed.data.quoteAuthor : undefined,
      announcement: formData.has('announcement') ? parsed.data.announcement : undefined,
      starts_at: parsed.data.startsAt ?? undefined,
      ends_at: parsed.data.endsAt,
      event_at: null,
      period_mode: current.period_mode,
      timezone: parsed.data.timezone,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Esse endereço já está ocupado. Escolhe outro nome para a página.' }
    return { error: 'Não foi possível guardar as alterações.' }
  }

  // Persist only reward positions included in this form; preserve other positions.
  const submittedPositions = REWARD_POSITIONS.filter((position) => formData.has(`reward-${position}-amount`) && formData.has(`reward-${position}-label`))
  const rewards = readRewards(formData).filter((reward) => submittedPositions.includes(reward.position))
  if (rewards.length) {
    const { error: rewardError } = await supabase.from('rewards').upsert(rewards.map((reward) => ({
      leaderboard_id: id, position: reward.position, amount_cents: reward.amountCents, label: reward.label,
    })), { onConflict: 'leaderboard_id,position' })
    if (rewardError) return { error: 'Não foi possível guardar os prémios. Tenta novamente.' }
  }
  const emptyPositions = submittedPositions.filter((position) => !rewards.some((reward) => reward.position === position))
  if (emptyPositions.length) {
    const { error: rewardError } = await supabase.from('rewards').delete().eq('leaderboard_id', id).in('position', emptyPositions)
    if (rewardError) return { error: 'Não foi possível remover os prémios. Tenta novamente.' }
  }

  // O ranking muda de janela quando as datas mudam.
  await createAdminClient().rpc('recompute_leaderboard', { p_leaderboard_id: id })

  if (current?.slug) revalidateTag(`lb:${current.slug}`)
  if (parsed.data.slug) revalidateTag(`lb:${parsed.data.slug}`)
  revalidatePath(`/dashboard/l/${id}`)

  return { success: true, slug: parsed.data.slug }
}

export async function endLeaderboardAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id || !await getOwnedLeaderboard(id)) return

  const supabase = await createClient()
  const { data } = await supabase
    .from('leaderboards')
    .update({ status: 'ended', ends_at: new Date().toISOString() })
    .eq('id', id)
    .select('slug')
    .maybeSingle()

  await createAdminClient().rpc('recompute_leaderboard', { p_leaderboard_id: id })

  if (data?.slug) revalidateTag(`lb:${data.slug}`)
  revalidatePath(`/dashboard/l/${id}`)
  revalidatePath('/dashboard')
}

export async function reopenLeaderboardAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id || !await getOwnedLeaderboard(id)) return

  const supabase = await createClient()
  const { data } = await supabase
    .from('leaderboards')
    .update({ status: 'active', ends_at: null })
    .eq('id', id)
    .select('slug')
    .maybeSingle()

  await createAdminClient().rpc('recompute_leaderboard', { p_leaderboard_id: id })

  if (data?.slug) revalidateTag(`lb:${data.slug}`)
  revalidatePath(`/dashboard/l/${id}`)
  revalidatePath('/dashboard')
}
