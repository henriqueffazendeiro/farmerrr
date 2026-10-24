import { z } from 'zod'

/**
 * Variáveis de ambiente validadas.
 *
 * As do servidor são lidas de forma preguiçosa (`serverEnv()`) para que a
 * landing continue a arrancar sem Supabase configurado — útil na Etapa 1 e
 * para quem só quer ver o design.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('farmerrr'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
})

// Next substitui NEXT_PUBLIC_* em tempo de build: têm de ser referidas
// literalmente, não por indexação dinâmica.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined,
})

/** true quando há credenciais suficientes para falar com o Supabase. */
export const supabaseConfigured =
  Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export function requireSupabasePublic() {
  if (!supabaseConfigured) {
    throw new Error(
      'Supabase não está configurado. Preenche NEXT_PUBLIC_SUPABASE_URL e ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (ver README).',
    )
  }
  return {
    url: publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  }
}

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SOCIAL_PROVIDER: z.enum(['mock', 'tiktok']).default('mock'),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  CLIPPER_SESSION_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Variáveis de ambiente em falta ou inválidas: ${missing}`)
  }
  cached = parsed.data
  return cached
}
