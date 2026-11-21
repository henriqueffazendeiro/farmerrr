import 'server-only'

import type { SocialProviderId } from '@/lib/db/types'
import type { SocialProvider } from '@/lib/providers/types'
import { serverEnv } from '@/lib/config/env'
import { tiktokProvider } from '@/lib/providers/tiktok'
import { mockProvider } from '@/lib/providers/mock'

/** API oficial em produção; mock apenas para desenvolvimento explícito. */
export function getProvider(id: SocialProviderId = 'tiktok'): SocialProvider {
  if (id !== 'tiktok') {
    throw new Error(`Plataforma ainda não suportada: ${id}`)
  }

  const { SOCIAL_PROVIDER } = serverEnv()

  if (SOCIAL_PROVIDER === 'tiktok') {
    if (tiktokProvider.isConfigured()) return tiktokProvider
    throw new Error('A ligação real ao TikTok ainda não está configurada.')
  }

  if (process.env.NODE_ENV === 'production') throw new Error('Contas simuladas não estão disponíveis em produção.')
  return mockProvider
}

export function isMockMode(): boolean {
  return serverEnv().SOCIAL_PROVIDER === 'mock'
}

export function tiktokConnectionAvailable(): boolean {
  return isMockMode() ? process.env.NODE_ENV !== 'production' : tiktokProvider.isConfigured()
}
