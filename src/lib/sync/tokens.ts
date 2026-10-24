import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SocialAccount } from '@/lib/db/types'
import type { ProviderTokens, SocialProvider } from '@/lib/providers/types'
import { decryptToken, encryptOptional, encryptToken } from '@/lib/crypto/tokens'
import { ProviderError } from '@/lib/providers/types'

const REFRESH_MARGIN_MS = 30 * 60 * 1000 // renova 30 min antes de expirar

type Admin = SupabaseClient<Database>

function toTokens(account: SocialAccount): ProviderTokens {
  return {
    providerUserId: account.provider_user_id,
    accessToken: account.access_token_enc ? decryptToken(account.access_token_enc) : '',
    refreshToken: account.refresh_token_enc ? decryptToken(account.refresh_token_enc) : null,
    accessExpiresAt: account.access_expires_at ? new Date(account.access_expires_at) : null,
    refreshExpiresAt: account.refresh_expires_at ? new Date(account.refresh_expires_at) : null,
    scopes: account.scopes ?? [],
  }
}

export async function persistTokens(
  admin: Admin,
  accountId: string,
  tokens: ProviderTokens,
): Promise<void> {
  const { error } = await admin
    .from('social_accounts')
    .update({
      access_token_enc: encryptToken(tokens.accessToken),
      refresh_token_enc: encryptOptional(tokens.refreshToken),
      access_expires_at: tokens.accessExpiresAt?.toISOString() ?? null,
      refresh_expires_at: tokens.refreshExpiresAt?.toISOString() ?? null,
      scopes: tokens.scopes,
      status: 'connected',
    })
    .eq('id', accountId)
  if (error) throw error
}

export async function markNeedsReauth(admin: Admin, accountId: string): Promise<void> {
  await admin.from('social_accounts').update({ status: 'needs_reauth' }).eq('id', accountId)
}

/**
 * Tokens prontos a usar: renova antes de expirar e guarda o novo refresh
 * token (o do TikTok é rotativo — cada renovação devolve um novo).
 */
export async function usableTokens(
  admin: Admin,
  provider: SocialProvider,
  account: SocialAccount,
): Promise<ProviderTokens> {
  const current = toTokens(account)

  const expiring =
    current.accessExpiresAt != null &&
    current.accessExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS

  if (!expiring || !current.refreshToken) return current

  try {
    const refreshed = await provider.refreshTokens(current.refreshToken)
    await persistTokens(admin, account.id, refreshed)
    return refreshed
  } catch (error) {
    if (error instanceof ProviderError && error.kind === 'auth') {
      await markNeedsReauth(admin, account.id)
    }
    throw error
  }
}
