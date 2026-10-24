import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { requireSupabasePublic, serverEnv } from '@/lib/config/env'

/**
 * Cliente com service role: ignora a RLS.
 *
 * Usar APENAS em código que corre no servidor e que precisa de escrever em
 * tabelas fechadas — ligação de contas TikTok, sincronizações, webhooks.
 * Nunca importar a partir de um componente cliente.
 */
export function createAdminClient() {
  const { url } = requireSupabasePublic()
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv()

  return createClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
