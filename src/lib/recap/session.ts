import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { serverEnv } from '@/lib/config/env'
export const CLIPPER_COOKIE = 'farmerrr_clipper'
function signature(body: string) {
  const secret = serverEnv().CLIPPER_SESSION_SECRET
  if (!secret) throw new Error('CLIPPER_SESSION_SECRET em falta.')
  return createHmac('sha256', secret).update(body).digest('base64url')
}
export function makeClipperSession(participantId: string) {
  const body = Buffer.from(JSON.stringify({ participantId, exp: Date.now() + 7 * 86400000 })).toString('base64url')
  return `${body}.${signature(body)}`
}
export async function readClipperSession(): Promise<{ participantId: string } | null> {
  const value = (await cookies()).get(CLIPPER_COOKIE)?.value
  if (!value) return null
  try {
    const [body, sig, extra] = value.split('.')
    if (!body || !sig || extra) return null
    const a = Buffer.from(sig); const b = Buffer.from(signature(body))
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return typeof payload.participantId === 'string' && typeof payload.exp === 'number' && payload.exp > Date.now() ? payload : null
  } catch { return null }
}
