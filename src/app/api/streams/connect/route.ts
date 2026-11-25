import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMyCreator } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { isStreamPlatform } from '@/lib/streams/model'
import { PUBLIC_STREAM_MARKER, publicStreamsConfigured, readPublicChannel } from '@/lib/streams/public-provider'
import { normalizeStreamChannel } from '@/lib/streams/public-input'
import { trackingRateKey } from '@/lib/auth/rate-key'
import { syncStreamConnection } from '@/lib/streams/sync'
import { keepOnlyConnection } from '@/lib/streams/connections'

export const maxDuration = 120

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 403 })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Inicia sessão para ligar um canal.' }, { status: 401 })
  const creator = await getMyCreator()
  if (!creator) return NextResponse.json({ error: 'Cria primeiro o teu perfil de criador.' }, { status: 403 })
  try {
    const input = await request.json()
    if (!input || !isStreamPlatform(input.platform) || typeof input.channel !== 'string') return NextResponse.json({ error: 'Escolhe a plataforma e introduz o canal.' }, { status: 400 })
    const channel = normalizeStreamChannel(input.platform, input.channel)
    if (!publicStreamsConfigured(input.platform)) return NextResponse.json({ error: 'A ligação de canais ainda não está configurada.' }, { status: 503 })
    const db = createAdminClient()
    const { data: previous, error: lookupError } = await db.from('stream_connections').select('id').eq('creator_id', creator.id).eq('platform', input.platform).maybeSingle()
    if (lookupError) throw lookupError
    if (previous) return NextResponse.json({ error: 'Desliga o canal atual antes de ligar outro nesta plataforma.' }, { status: 409 })
    const { data: allowed, error: budgetError } = await db.rpc('consume_public_tracking_attempt', { p_key: trackingRateKey(`streams:${creator.id}`) })
    if (budgetError) throw budgetError
    if (!allowed) return NextResponse.json({ error: 'Atingiste o limite de tentativas. Tenta dentro de uma hora.' }, { status: 429 })
    // Ao ligar, importa também as lives recentes para o Absolute Cinema começar preenchido.
    const snapshot = await readPublicChannel(input.platform, channel, { history: true })
    const { streams: _streams, past: _past, ...identity } = snapshot
    const { data, error } = await db.from('stream_connections').insert({ creator_id: creator.id, platform: input.platform, ...identity,
      access_token_enc: PUBLIC_STREAM_MARKER, refresh_token_enc: null, expires_at: '9999-01-01T00:00:00Z', status: 'connected',
    }).select('id,platform,channel_name,channel_url,status').single()
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'Este canal ou plataforma já está ligado.' : 'Não foi possível guardar o canal.' }, { status: 409 })
    // O canal novo substitui o anterior; as lives e avaliações antigas ficam guardadas.
    await keepOnlyConnection(creator.id, data.id)
    let pending = false
    try { await syncStreamConnection(data.id, snapshot) } catch { pending = true }
    revalidatePath('/', 'layout')
    return NextResponse.json({ connection: data, message: pending ? 'Canal ligado. A primeira atualização será repetida.' : 'Canal ligado.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const safe = /^(Introduz |O URL |Não foi possível consultar|O canal devolvido|A plataforma devolveu)/.test(message)
    return NextResponse.json({ error: safe ? message : 'Não foi possível ler este canal. Confirma o username e tenta novamente.' }, { status: 400 })
  }
}
