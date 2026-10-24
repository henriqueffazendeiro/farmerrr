import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getProvider, isMockMode } from '@/lib/providers/registry'
import { connectAccountToLeaderboard } from '@/lib/clippers/join'
import { syncAccount } from '@/lib/sync/account'

export type SeedResult = {
  leaderboardName: string
  slug: string
  created: { username: string | null; clips: number }[]
  failed: string[]
}

/** Nome e @ que um clipfarmer simulado passa a ter. */
type Persona = { displayName: string; username: string }

export function seedAvailable(): boolean {
  return process.env.NODE_ENV !== 'production' && isMockMode()
}

/**
 * Enche uma competição com clipfarmers simulados.
 *
 * Passa exatamente pelo mesmo caminho que um clipper real — liga a conta,
 * importa os clips, recalcula o ranking. Não escreve atalhos na base de
 * dados: se isto funciona, o fluxo verdadeiro funciona.
 *
 * O código de cada conta é estável, por isso correr outra vez atualiza os
 * mesmos clipfarmers em vez de criar duplicados.
 */
export async function seedLeaderboard(
  slug: string,
  count: number,
  personas?: Persona[],
): Promise<SeedResult> {
  if (!seedAvailable()) {
    throw new Error('O modo de demonstração só corre fora de produção e com SOCIAL_PROVIDER=mock.')
  }

  const total = Math.min(Math.max(count, 1), 20)
  const admin = createAdminClient()

  const { data: leaderboard } = await admin
    .from('leaderboards')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle()

  if (!leaderboard) {
    throw new Error(`Não existe nenhum leaderboard em /${slug}.`)
  }

  const provider = getProvider('tiktok')
  const created: SeedResult['created'] = []
  const failed: string[] = []

  for (let i = 1; i <= total; i++) {
    const code = `seed-${slug}-${i}`
    const persona = personas?.[i - 1]

    try {
      const tokens = await provider.exchangeCode(code)
      const account = await provider.getAccount(tokens)

      const { socialAccountId } = await connectAccountToLeaderboard({
        leaderboardId: leaderboard.id,
        provider: 'tiktok',
        tokens,
        account,
      })

      const result = await syncAccount(socialAccountId, 'discover')

      // O sync escreve o nome que o provider devolveu; se houver uma persona
      // para esta posição, fica com ela. É só cosmético — as métricas são as
      // que o provider gerou.
      if (persona) {
        const { data: social } = await admin
          .from('social_accounts')
          .update({
            username: persona.username,
            display_name: persona.displayName,
            profile_url: `https://www.tiktok.com/@${persona.username}`,
          })
          .eq('id', socialAccountId)
          .select('clipper_profile_id')
          .maybeSingle()

        if (social) {
          await admin
            .from('clipper_profiles')
            .update({ display_name: persona.displayName })
            .eq('id', social.clipper_profile_id)
        }
      }

      created.push({
        username: persona?.username ?? account.username,
        clips: result.discovered + result.refreshed,
      })
    } catch (error) {
      console.error(`[farmerrr] seed ${code} falhou`, error)
      failed.push(code)
    }
  }

  return {
    leaderboardName: leaderboard.name,
    slug: leaderboard.slug,
    created,
    failed,
  }
}

// ─── Competição de demonstração ──────────────────────────────────────────

const DEMO_SLUG = 'kaicenat'
const DEMO_CREATOR = 'Kai Cenat'

/**
 * Contas inventadas, no estilo das que orbitam um streamer grande.
 * Nenhuma existe — são só nomes plausíveis para a demonstração.
 */
const DEMO_PERSONAS: Persona[] = [
  { displayName: 'Clips of Kai', username: 'clipsofkai' },
  { displayName: 'Cenat Daily', username: 'cenatdaily' },
  { displayName: 'Best of Kai', username: 'bestofkaiclips' },
  { displayName: 'Kai Reacts', username: 'kaireactsclips' },
  { displayName: 'Cenat Cuts', username: 'cenatcuts' },
  { displayName: 'Kai Highlights', username: 'kaihighlightsx' },
  { displayName: 'Kai Moments', username: 'kaimomentshq' },
  { displayName: 'Cenat Edits', username: 'cenateditz' },
  { displayName: 'Rage Clips', username: 'kairageclips' },
  { displayName: 'Stream Cuts', username: 'streamcutsdaily' },
]

/** Início do mês corrente, em UTC. */
function monthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** Último dia do mês corrente, às 21:00 — a "live de análise". */
function monthEndEvent(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 21, 0, 0))
}

export type DemoResult = SeedResult & { creatorName: string }

/**
 * Monta a competição de demonstração completa: creator, leaderboard com
 * aviso, citação e contagem decrescente, prémios, e dez clipfarmers com
 * clips e views a crescer.
 *
 * Correr outra vez atualiza a mesma competição — não duplica nada.
 */
export async function seedDemoCompetition(ownerProfileId: string): Promise<DemoResult> {
  if (!seedAvailable()) {
    throw new Error('O modo de demonstração só corre fora de produção e com SOCIAL_PROVIDER=mock.')
  }

  const admin = createAdminClient()

  // 1. Creator
  const { data: existingCreator } = await admin
    .from('creators')
    .select('id, owner_id')
    .eq('handle', DEMO_SLUG)
    .maybeSingle()

  if (existingCreator && existingCreator.owner_id !== ownerProfileId) {
    throw new Error(
      `O endereço "${DEMO_SLUG}" já está ocupado por outra conta neste projeto Supabase.`,
    )
  }

  let creatorId = existingCreator?.id
  if (!creatorId) {
    const { data: creator, error } = await admin
      .from('creators')
      .insert({ owner_id: ownerProfileId, name: DEMO_CREATOR, handle: DEMO_SLUG })
      .select('id')
      .single()

    if (error || !creator) throw new Error('Não foi possível criar o creator de demonstração.')
    creatorId = creator.id
  }

  // 2. Leaderboard
  const fields = {
    creator_id: creatorId,
    name: 'Clip Battle',
    slug: DEMO_SLUG,
    description: 'Quem gerar mais views com clips do stream ganha o prémio do mês.',
    announcement:
      'DEMONSTRAÇÃO — dados simulados. Não é uma competição real nem uma parceria com o streamer.',
    quote:
      'Na última live de cada mês vou ver as vossas contas ao vivo. Quem tiver mais views leva o prémio na hora — e se a conta for mesmo boa, falamos de trabalho.',
    quote_author: DEMO_CREATOR,
    rules:
      'Só contam clips do stream publicados durante o mês.\n' +
      'Nada de conteúdo roubado a outros clippers.\n' +
      'A conta tem de estar pública para as views poderem ser lidas.',
    starts_at: monthStart().toISOString(),
    ends_at: null,
    event_at: monthEndEvent().toISOString(),
    period_mode: 'monthly' as const,
    status: 'active' as const,
    timezone: 'Europe/Lisbon',
  }

  const { data: existingBoard } = await admin
    .from('leaderboards')
    .select('id')
    .eq('slug', DEMO_SLUG)
    .maybeSingle()

  let leaderboardId = existingBoard?.id
  if (leaderboardId) {
    await admin.from('leaderboards').update(fields).eq('id', leaderboardId)
  } else {
    const { data: board, error } = await admin
      .from('leaderboards')
      .insert(fields)
      .select('id')
      .single()

    if (error || !board) throw new Error('Não foi possível criar a competição de demonstração.')
    leaderboardId = board.id
  }

  // 3. Prémios
  await admin.from('rewards').delete().eq('leaderboard_id', leaderboardId)
  await admin.from('rewards').insert([
    { leaderboard_id: leaderboardId, position: 1, label: 'Pago em live', amount_cents: 50_000 },
    { leaderboard_id: leaderboardId, position: 2, label: null, amount_cents: 25_000 },
    { leaderboard_id: leaderboardId, position: 3, label: null, amount_cents: 10_000 },
    {
      leaderboard_id: leaderboardId,
      position: 4,
      label: 'Candidato a contratação',
      amount_cents: null,
    },
  ])

  // 4. Clipfarmers
  const result = await seedLeaderboard(DEMO_SLUG, DEMO_PERSONAS.length, DEMO_PERSONAS)

  return { ...result, creatorName: DEMO_CREATOR }
}
