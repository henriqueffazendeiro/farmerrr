import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { requireSupabasePublic } from '@/lib/config/env'

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a chave anónima — a RLS é que decide o que este utilizador pode ver.
 */
export async function createClient() {
  const { url, anonKey } = requireSupabasePublic()
  const cookieStore = await cookies()

  // SSR 0.5's declarations use the older SupabaseClient generic ordering.
  // The runtime client is unchanged; expose the installed SDK's database type.
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Chamado a partir de um Server Component: o middleware trata da
          // renovação da sessão, por isso pode ser ignorado com segurança.
        }
      },
    },
  }) as unknown as SupabaseClient<Database>
}

/** Utilizador autenticado, ou null. */
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
