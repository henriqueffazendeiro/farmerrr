import 'server-only'

import crypto from 'node:crypto'
import { serverEnv } from '@/lib/config/env'

/**
 * `state` do OAuth: assinado com HMAC e válido por 10 minutos.
 * Junto com um cookie httpOnly que guarda o mesmo nonce, protege contra CSRF
 * — quem reenviar um callback roubado não tem o cookie.
 */

export type OAuthState = {
  leaderboardId: string
  slug: string
  nonce: string
  exp: number
  recap?: boolean
  recapMonth?: string
}

export const STATE_COOKIE = 'farmerrr_oauth'
const TTL_MS = 10 * 60 * 1000

function secret(): string {
  const { CLIPPER_SESSION_SECRET } = serverEnv()
  if (!CLIPPER_SESSION_SECRET) {
    throw new Error('CLIPPER_SESSION_SECRET em falta — necessária para o login do clipper.')
  }
  return CLIPPER_SESSION_SECRET
}

function sign(data: string): string {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url')
}

export function createState(leaderboardId: string, slug: string, recap = false, recapMonth?: string) {
  const nonce = crypto.randomBytes(16).toString('base64url')
  const payload: OAuthState = { leaderboardId, slug, nonce, exp: Date.now() + TTL_MS, recap, recapMonth }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { state: `${body}.${sign(body)}`, nonce }
}

export function readState(state: string, nonceFromCookie: string | undefined): OAuthState | null {
  const [body, signature] = state.split('.')
  if (!body || !signature) return null

  const expected = sign(body)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  let payload: OAuthState
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (payload.exp < Date.now()) return null
  if (!nonceFromCookie || nonceFromCookie !== payload.nonce) return null

  return payload
}
