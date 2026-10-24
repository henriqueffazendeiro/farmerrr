import { Flame, Heart, MessageCircle, Play } from 'lucide-react'
import type { VideoRow } from '@/lib/db/board'
import { compactNumber, shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export function VideoCard({
  video,
  highlight = false,
  showClipper = true,
}: {
  video: VideoRow
  highlight?: boolean
  showClipper?: boolean
}) {
  const href = video.url ?? video.embed_link ?? undefined

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-lg border bg-surface/70 transition-transform duration-200 hover:-translate-y-0.5',
        highlight ? 'border-gold/40' : 'border-line hover:border-line-strong',
      )}
    >
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-surface-2">
        {video.thumbnail_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={video.thumbnail_url}
            alt={video.caption ?? 'Clip'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Play className="h-8 w-8 text-fg-subtle" strokeWidth={1.5} />
          </div>
        )}

        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/85 to-transparent"
        />

        {highlight && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-sm bg-gold/90 px-2 py-1 text-[10px] font-semibold tracking-wide text-black uppercase">
            <Flame className="h-3 w-3" strokeWidth={2.5} />
            Maior clip
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="nums text-xl font-semibold tracking-tight text-white drop-shadow">
            {compactNumber(video.latest_views)}
          </p>
          <p className="text-[10px] tracking-[0.1em] text-white/70 uppercase">views</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {showClipper ? (
          <p className="truncate text-xs font-medium text-fg">
            {video.username ? `@${video.username}` : video.clipperName}
          </p>
        ) : null}
        <p className="line-clamp-2 text-xs leading-relaxed text-fg-muted">
          {video.caption || 'Sem legenda'}
        </p>
        <div className="nums mt-auto flex items-center gap-3 pt-1 text-[11px] text-fg-subtle">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" strokeWidth={2} />
            {compactNumber(video.latest_likes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3 w-3" strokeWidth={2} />
            {compactNumber(video.latest_comments)}
          </span>
          <span className="ml-auto">{shortDate(video.published_at)}</span>
        </div>
      </div>
    </a>
  )
}
