import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge, LiveDot } from '@/components/ui/badge'
import { CopyButton } from '@/components/dashboard/copy-button'
import { SubNav } from '@/components/dashboard/sub-nav'
import { getOwnedLeaderboard } from '@/lib/db/queries'
import { publicEnv } from '@/lib/config/env'

export default async function LeaderboardAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const leaderboard = await getOwnedLeaderboard(id)
  if (!leaderboard) notFound()

  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const publicUrl = `${base}/${leaderboard.slug}`
  const inviteUrl = `${base}/join/${leaderboard.slug}`

  return (
    <div className="mx-auto max-w-[900px]">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Leaderboards
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{leaderboard.name}</h1>
            {leaderboard.status === 'active' ? (
              <Badge tone="live">
                <LiveDot />
                Ativo
              </Badge>
            ) : (
              <Badge>Terminado</Badge>
            )}
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-fg-subtle transition-colors hover:text-fg"
          >
            {publicUrl.replace(/^https?:\/\//, '')}
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/${leaderboard.slug}/recap`} className="rounded-sm border border-line px-3 py-2 text-sm text-fg-muted hover:text-fg">Recap mensal</Link>
          <CopyButton value={inviteUrl} label="Copiar convite" variant="primary" />
          <CopyButton value={publicUrl} label="Copiar link público" />
        </div>
      </div>

      <SubNav basePath={`/dashboard/l/${id}`} />

      <div className="mt-8">{children}</div>
    </div>
  )
}
