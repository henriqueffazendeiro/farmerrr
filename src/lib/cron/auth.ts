import 'server-only'

import type { NextRequest } from 'next/server'
import { serverEnv } from '@/lib/config/env'

/**
 * As rotas de cron são públicas por natureza (a Vercel chama-as por HTTP),
 * por isso exigem um segredo. A Vercel envia-o no cabeçalho Authorization
 * quando CRON_SECRET está definido no projeto.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const { CRON_SECRET } = serverEnv()
  if (!CRON_SECRET) return false

  const header = request.headers.get('authorization') ?? ''
  if (header === `Bearer ${CRON_SECRET}`) return true

  // Alternativa útil para chamar à mão em desenvolvimento.
  return new URL(request.url).searchParams.get('secret') === CRON_SECRET
}
