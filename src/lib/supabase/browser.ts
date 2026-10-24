'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/db/types'
import { requireSupabasePublic } from '@/lib/config/env'

export function createClient() {
  const { url, anonKey } = requireSupabasePublic()
  return createBrowserClient<Database>(url, anonKey)
}
