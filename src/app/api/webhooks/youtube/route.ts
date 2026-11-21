import { after, NextResponse } from 'next/server'
import { handleYouTubeEvent, verifyYouTube, youtubeChannelConnected } from '@/lib/streams/webhooks'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const channelOf = (topic: string | null) => topic?.match(/[?&]channel_id=(UC[\w-]{22})$/)?.[1] ?? null

/** WebSub: o hub confirma a subscrição (ou o cancelamento) ecoando o desafio. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const channel = channelOf(params.get('hub.topic'))
  const mode = params.get('hub.mode')
  const challenge = params.get('hub.challenge')
  if (!channel || !challenge || (mode !== 'subscribe' && mode !== 'unsubscribe')) return new Response('Pedido inválido.', { status: 400 })
  // Só aceita subscrever canais ligados e cancelar canais que já não estão ligados.
  if ((mode === 'subscribe') !== await youtubeChannelConnected(channel)) return new Response('Não reconhecido.', { status: 404 })
  return new Response(challenge, { headers: { 'Content-Type': 'text/plain' } })
}

/** Aviso de vídeo publicado/alterado (inclui lives a começar). */
export async function POST(request: Request) {
  const body = await request.text()
  if (!verifyYouTube(request.headers, body)) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 403 })
  const channel = body.match(/<yt:channelId>(UC[\w-]{22})<\/yt:channelId>/)?.[1]
  if (channel) after(() => handleYouTubeEvent(channel).catch(error => console.error('[youtube webhook]', error)))
  return new Response(null, { status: 204 })
}
