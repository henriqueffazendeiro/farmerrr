import { notFound } from 'next/navigation'
import { EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { getOwnedLeaderboard } from '@/lib/db/queries'
import { getVideos } from '@/lib/db/board'
import { currentPeriodKey } from '@/lib/period'
import { fullNumber, shortDate } from '@/lib/format'
import { excludeVideoAction, includeVideoAction } from '@/lib/leaderboards/admin-actions'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Vídeos' }

export default async function VideosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const leaderboard = await getOwnedLeaderboard(id)
  if (!leaderboard) notFound()

  const videos = await getVideos(leaderboard, {
    periodKey: currentPeriodKey(leaderboard),
    limit: 200,
    includeExcluded: true,
  })

  if (videos.length === 0) {
    return (
      <Card>
        <CardBody className="py-16 text-center">
          <p className="text-sm font-medium text-fg">Ainda não há vídeos.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
            Assim que um clipper ligar a conta, os clips publicados durante a competição
            aparecem aqui automaticamente.
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="overflow-x-auto pt-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line/60 text-left text-[11px] tracking-[0.08em] text-fg-subtle uppercase">
              <th className="pb-3 font-medium">Clip</th>
              <th className="pb-3 font-medium">Clipper</th>
              <th className="pb-3 text-right font-medium">Views</th>
              <th className="pb-3 text-right font-medium">Data</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {videos.map((video) => (
              <tr key={video.id} className={cn(video.excluded && 'opacity-45')}>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    {video.thumbnail_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={video.thumbnail_url}
                        alt=""
                        className="h-14 w-10 shrink-0 rounded-xs border border-line object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-14 w-10 shrink-0 rounded-xs border border-line bg-surface-2" />
                    )}
                    <p className="line-clamp-2 max-w-[280px] text-fg-muted">
                      {video.caption || 'Sem legenda'}
                    </p>
                  </div>
                </td>
                <td className="py-3 text-fg-muted">
                  {video.username ? `@${video.username}` : video.clipperName}
                </td>
                <td className="nums py-3 text-right font-semibold">
                  {fullNumber(video.latest_views)}
                </td>
                <td className="py-3 text-right text-xs text-fg-subtle">
                  {shortDate(video.published_at)}
                </td>
                <td className="py-3 pl-4 text-right">
                  <form action={video.excluded ? includeVideoAction : excludeVideoAction}>
                    <input type="hidden" name="leaderboardId" value={id} />
                    <input type="hidden" name="videoId" value={video.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={video.excluded ? 'secondary' : 'danger'}
                    >
                      {video.excluded ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                          Repor
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
                          Excluir
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
