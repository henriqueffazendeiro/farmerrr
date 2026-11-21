import { after, NextResponse } from 'next/server'
import { handleKickEvent, kickEventSchema, verifyKick } from '@/lib/streams/webhooks'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Kick: livestream.status.updated (assinado com a chave pública da Kick). */
export async function POST(request: Request) {
  const body = await request.text()
  if (!await verifyKick(request.headers, body)) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 403 })
  if (request.headers.get('kick-event-type') === 'livestream.status.updated') {
    const event = kickEventSchema.safeParse(JSON.parse(body))
    if (event.success) after(() => handleKickEvent(event.data).catch(error => console.error('[kick webhook]', error)))
  }
  return new Response(null, { status: 204 })
}
