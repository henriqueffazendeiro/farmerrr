import { notFound } from 'next/navigation'
import { getLeaderboardBySlug } from '@/lib/leaderboards/public-data'
import { getRecaps } from '@/lib/recap/data'
import { RecapExperience } from '@/components/recap/recap-experience'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Recap mensal · farmerrr' }
export default async function RecapPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ mes?: string }>
}) {
  const { slug } = await params
  const { mes } = await searchParams
  const lb = await getLeaderboardBySlug(slug)
  if (!lb || !lb.is_public || lb.status === 'draft') notFound()
  const recaps = await getRecaps(lb)
  const recap = mes ? recaps.find(r => r.period_key === mes) : recaps[0]
  if (mes && !recap) notFound()
  return <RecapExperience key={recap?.id ?? 'empty'} slug={slug} recap={recap ?? null} />
}
