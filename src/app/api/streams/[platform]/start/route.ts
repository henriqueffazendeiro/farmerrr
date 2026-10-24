import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMyCreator } from '@/lib/db/queries'
import { publicEnv } from '@/lib/config/env'
import { isStreamPlatform } from '@/lib/streams/model'
import { authorizationUrl, streamConfigured } from '@/lib/streams/providers'
import { encryptToken } from '@/lib/crypto/tokens'

export async function GET(_request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  if (!isStreamPlatform(platform)) return new NextResponse('Plataforma inválida', { status: 404 })
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL('/entrar', publicEnv.NEXT_PUBLIC_APP_URL))
  const creator = await getMyCreator()
  if (!creator || !streamConfigured(platform)) return NextResponse.redirect(new URL('/dashboard/conta?streams=unavailable', publicEnv.NEXT_PUBLIC_APP_URL))
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const jar = await cookies()
  jar.set(`farmerrr_stream_${platform}`, encryptToken(JSON.stringify({ state, verifier, userId: user.id, creatorId: creator.id, expires: Date.now() + 600_000 })), {
    httpOnly: true, secure: new URL(publicEnv.NEXT_PUBLIC_APP_URL).protocol === 'https:', sameSite: 'lax', path: `/api/streams/${platform}`, maxAge: 600,
  })
  return NextResponse.redirect(authorizationUrl(platform, state, verifier))
}
