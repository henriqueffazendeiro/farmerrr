import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { data, error } = await createAdminClient().rpc('generate_monthly_recaps', {})
  if (error) return NextResponse.json({ error: 'Não foi possível gerar os recaps.' }, { status: 500 })
  return NextResponse.json({ generated: data })
}
