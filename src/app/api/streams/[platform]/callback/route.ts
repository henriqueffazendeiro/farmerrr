import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { publicEnv } from '@/lib/config/env'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMyCreator } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken, encryptToken } from '@/lib/crypto/tokens'
import { isStreamPlatform } from '@/lib/streams/model'
import { exchangeStreamToken, streamIdentity } from '@/lib/streams/providers'
import { syncStreamConnection } from '@/lib/streams/sync'

const stateSchema = z.object({ state: z.string(), verifier: z.string(), userId: z.string().uuid(), creatorId: z.string().uuid(), expires: z.number() })
export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  if (!isStreamPlatform(platform)) return new NextResponse('Plataforma inválida', { status: 404 })
  const done = (status: string) => NextResponse.redirect(new URL(`/dashboard/conta?streams=${status}`, publicEnv.NEXT_PUBLIC_APP_URL))
  const jar = await cookies()
  const cookie = jar.get(`farmerrr_stream_${platform}`)?.value
  jar.set(`farmerrr_stream_${platform}`, '', { path: `/api/streams/${platform}`, maxAge: 0 })
  try {
    const query = new URL(request.url).searchParams
    if (!cookie || !query.get('code') || query.has('error')) return done('cancelled')
    const state = stateSchema.parse(JSON.parse(decryptToken(cookie)))
    const user = await getCurrentUser()
    const creator = await getMyCreator()
    if (!user || !creator || state.userId !== user.id || state.creatorId !== creator.id || state.expires < Date.now() || state.state !== query.get('state')) return done('invalid')
    const tokens = await exchangeStreamToken(platform, { code: query.get('code')!, verifier: state.verifier })
    const identity = await streamIdentity(platform, tokens.access_token)
    const db = createAdminClient()
    const { data: previous, error: lookupError } = await db.from('stream_connections').select('channel_id,refresh_token_enc,sync_locked_until')
      .eq('creator_id', creator.id).eq('platform', platform).maybeSingle()
    if (lookupError) throw lookupError
    if (previous && new Date(previous.sync_locked_until).getTime() > Date.now()) return done('busy')
    // Preserve refresh credentials only when reconnecting the exact same channel.
    const refresh = tokens.refresh_token ? encryptToken(tokens.refresh_token)
      : previous?.channel_id === identity.channel_id ? previous.refresh_token_enc : null
    if (!refresh) return done('offline_access')
    const { data, error } = await db.from('stream_connections').upsert({ creator_id: creator.id, platform, ...identity,
      access_token_enc: encryptToken(tokens.access_token), refresh_token_enc: refresh,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), status: 'connected', last_error: null,
    }, { onConflict: 'creator_id,platform' }).select('id').single()
    if (error) return done(error.code === '23505' ? 'claimed' : 'error')
    try { await syncStreamConnection(data.id) } catch { return done('sync_pending') }
    return done('connected')
  } catch { return done('error') }
}
