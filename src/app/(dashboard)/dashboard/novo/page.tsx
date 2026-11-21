import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { SetupWizard } from '@/components/dashboard/setup-wizard'
import { getMyCreator, getMyLeaderboard } from '@/lib/db/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { isStreamPlatform } from '@/lib/streams/model'

export const metadata: Metadata = { title: 'Criar a tua p?gina' }

export default async function NewLeaderboardPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams
  const creator = await getMyCreator()
  // As duas consultas só dependem do criador — correm em paralelo.
  const [leaderboard, { data }] = creator ? await Promise.all([
    getMyLeaderboard(creator.id),
    createAdminClient().from('stream_connections')
      .select('platform,channel_url').eq('creator_id', creator.id).order('created_at').limit(1).maybeSingle(),
  ]) : [null, { data: null }]
  if (leaderboard && preview !== '1') redirect(`/${leaderboard.slug}`)
  return <SetupWizard initialPlatform={data && isStreamPlatform(data.platform) ? data.platform : undefined}
    initialChannel={data?.channel_url} previewSlug={leaderboard?.slug} />
}
