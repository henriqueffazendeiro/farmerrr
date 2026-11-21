import 'server-only'
import { createHmac } from 'node:crypto'
import { serverEnv } from '@/lib/config/env'

function sign(body: string) {
  const secret = serverEnv().CLIPPER_SESSION_SECRET
  if (!secret) throw new Error('CLIPPER_SESSION_SECRET em falta.')
  return createHmac('sha256', secret).update(body).digest('base64url')
}
export function trackingRateKey(value: string) { return sign(`public-tracking:${value}`) }
