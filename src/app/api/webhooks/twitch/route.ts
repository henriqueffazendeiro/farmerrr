import { after, NextResponse } from 'next/server'
import { handleTwitchEvent, verifyTwitch } from '@/lib/streams/webhooks'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Twitch EventSub: stream.online / stream.offline. Responde logo; o trabalho corre depois da resposta. */
export async function POST(request: Request) {
  const body = await request.text()
  if (!verifyTwitch(request.headers, body)) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 403 })
  const message = JSON.parse(body)
  const type = request.headers.get('twitch-eventsub-message-type')
  if (type === 'webhook_callback_verification') return new Response(String(message.challenge), { headers: { 'Content-Type': 'text/plain' } })
  if (type === 'notification' && message.subscription?.type && message.event?.broadcaster_user_id) {
    after(() => handleTwitchEvent(message.subscription.type, message.event).catch(error => console.error('[twitch webhook]', error)))
  }
  // 'revocation': a subscrição volta a ser criada na verificação diária.
  return new Response(null, { status: 204 })
}
