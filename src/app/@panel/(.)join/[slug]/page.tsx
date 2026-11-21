import { JoinContent } from '@/components/leaderboard/join-content'

export const dynamic = 'force-dynamic'

export default async function JoinPanel({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string }>
}) {
  const [{ slug }, { erro }] = await Promise.all([params, searchParams])
  return <JoinContent slug={slug} erro={erro} panel />
}
