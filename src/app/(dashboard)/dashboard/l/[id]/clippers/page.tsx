import { notFound } from 'next/navigation'
import { AlertTriangle, Ban, RotateCcw } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { getOwnedLeaderboard } from '@/lib/db/queries'
import { getClippers } from '@/lib/db/board'
import { currentPeriodKey } from '@/lib/period'
import { compactNumber, fullNumber, shortDate } from '@/lib/format'
import { setParticipantStatusAction } from '@/lib/leaderboards/admin-actions'

export const metadata = { title: 'Clippers' }

export default async function ClippersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const leaderboard = await getOwnedLeaderboard(id)
  if (!leaderboard) notFound()

  const clippers = await getClippers(id, currentPeriodKey(leaderboard))

  if (clippers.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center">
          <p className="text-sm font-medium text-fg">Ainda não há clippers.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
            Partilha o link de convite. Cada pessoa liga a própria conta de TikTok e aparece
            aqui em segundos — não tens de adicionar ninguém à mão.
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="overflow-x-auto pt-5">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line/60 text-left text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
              <th className="pb-3 font-medium">Clipper</th>
              <th className="pb-3 text-right font-medium">Views</th>
              <th className="pb-3 text-right font-medium">Clips</th>
              <th className="pb-3 text-right font-medium">Média</th>
              <th className="pb-3 text-right font-medium">Seguidores</th>
              <th className="pb-3 text-right font-medium">Entrou</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {clippers.map((clipper) => (
              <tr key={clipper.participantId} className={clipper.status !== 'active' ? 'opacity-45' : ''}>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={clipper.displayName} src={clipper.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{clipper.displayName}</p>
                      <p className="truncate text-xs text-fg-subtle">
                        {clipper.username ? `@${clipper.username}` : '—'}
                        {clipper.needsReauth && (
                          <span className="ml-2 inline-flex items-center gap-1 text-gold">
                            <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                            precisa de reconectar
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="nums py-3 text-right font-semibold">
                  {fullNumber(clipper.totalViews)}
                </td>
                <td className="nums py-3 text-right text-fg-muted">{clipper.videoCount}</td>
                <td className="nums py-3 text-right text-fg-muted">
                  {compactNumber(clipper.avgViews)}
                </td>
                <td className="nums py-3 text-right text-fg-muted">
                  {clipper.followerCount == null ? '—' : compactNumber(clipper.followerCount)}
                </td>
                <td className="py-3 text-right text-xs text-fg-subtle">
                  {shortDate(clipper.joinedAt)}
                </td>
                <td className="py-3 pl-4 text-right">
                  <form action={setParticipantStatusAction}>
                    <input type="hidden" name="leaderboardId" value={id} />
                    <input type="hidden" name="participantId" value={clipper.participantId} />
                    <input
                      type="hidden"
                      name="status"
                      value={clipper.status === 'active' ? 'disqualified' : 'active'}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant={clipper.status === 'active' ? 'danger' : 'secondary'}
                    >
                      {clipper.status === 'active' ? (
                        <>
                          <Ban className="h-3.5 w-3.5" strokeWidth={2} />
                          Desqualificar
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                          Repor
                        </>
                      )}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  )
}
