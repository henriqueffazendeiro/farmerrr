'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Eye, Film, Gift, Heart, Play, Users } from 'lucide-react'
import type { ClipperRow, VideoRow } from '@/lib/db/board'
import { compactNumber, money, shortDate } from '@/lib/format'
import { ALL_TIME } from '@/lib/period'
import { SettingsDrawer } from '@/components/dashboard/settings-drawer'
import { cachedClipperDetails, loadClipperDetails, type ClipperDetails } from './clipper-details-cache'
import styles from './clipper-dialog.module.css'
import { TikTokPlayer } from './tiktok-player'
import { DiscordIcon, TikTokIcon } from '@/components/ui/discord-icon'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

/** Perfil do clipper, no mesmo painel lateral do "Participar". */
export function ClipperDialog({ clipper, slug, periodKey, onClose, onBan }: { clipper: ClipperRow; slug: string; periodKey: string; onClose: () => void; /** Só para o dono: abre o pop-up para banir este clipper. */ onBan?: () => void }) {
  const [details, setDetails] = useState<ClipperDetails | null>(() => cachedClipperDetails(slug, clipper.participantId, periodKey))
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null)

  useEffect(() => {
    let active = true
    loadClipperDetails(slug, clipper.participantId, periodKey).then(result => {
      if (active) setDetails(result)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [slug, clipper.participantId, periodKey, attempt])

  const row = details?.clipper ?? clipper
  const videos = details?.videos ?? []
  const selectedIndex = selectedVideo ? videos.findIndex(video => video.id === selectedVideo.id) : -1
  return <SettingsDrawer title={row.displayName} closeLabel="Fechar perfil" onClose={onClose}>
    {/* Igual ao topo da "Conta" do clipper: foto, TikTok e, por baixo, o Discord (sem o email, que é privado). */}
    <section aria-label="Perfil" className="-mt-4 mb-6 flex flex-wrap items-center gap-6">
      <Avatar src={avatarFailed ? null : row.avatarUrl} name={row.displayName} size="lg" className="rounded-sm border-0" onError={() => setAvatarFailed(true)} />
      <dl className="min-w-0 flex-1 space-y-1 text-sm">
        <dt className="sr-only">TikTok</dt>
        <dd className="flex items-center gap-1.5 break-all"><TikTokIcon className="shrink-0" />{row.username
          ? <a href={`https://www.tiktok.com/@${encodeURIComponent(row.username)}`} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">@{row.username}</a>
          : row.displayName}</dd>
        {details?.discord && <>
          <dt className="sr-only">Discord</dt>
          <dd className="flex items-center gap-1.5 break-all"><DiscordIcon className="shrink-0 text-[#5865f2]" />{details.discord}</dd>
        </>}
      </dl>
    </section>
    {onBan && <Button type="button" variant="danger" className="mb-6 w-full border-0 bg-danger/10 hover:bg-danger/20" onClick={onBan}>Banir</Button>}
    <div className={styles.drawerStats}>
      {[{ label: periodKey === ALL_TIME ? 'Views Totais' : 'Views no Mês', value: compactNumber(row.totalViews), icon: Eye },
        { label: 'Likes', value: compactNumber(row.totalLikes), icon: Heart },
        { label: 'Seguidores', value: row.followerCount == null ? '—' : compactNumber(row.followerCount), icon: Users },
        { label: 'Vídeos', value: row.videoCount, icon: Film },
        { label: 'Ganhos', value: !details ? '…' : details.earningsCents == null ? '—' : money(details.earningsCents), icon: Gift, featured: true }].map(stat => <div key={stat.label} className={`${styles.stat} ${stat.featured ? styles.featured : ''}`}><span><stat.icon size={14} />{stat.label}</span><strong>{stat.value}</strong></div>)}
    </div>
    <div aria-busy={!details && !error}>
      <div className={styles.listHeader}><h3>Clipes Rastreados{details ? ` (${videos.length})` : ''}</h3><span>Ordenados por visualizações</span></div>
      {error ? <div className={styles.empty} role="alert">Não foi possível carregar os clips.<button onClick={() => { setError(false); setAttempt(value => value + 1) }}>Tentar novamente</button></div> : !details ? <p className={styles.empty} role="status">A carregar clips...</p> : videos.length === 0 ? <p className={styles.empty}>Nenhum vídeo rastreado para esta conta neste período.</p> :
        <div className={styles.drawerGrid}>{videos.map(video => {
          return <button type="button" key={video.id} className={styles.video} onClick={() => setSelectedVideo(video)} aria-label={`Assistir: ${video.caption ?? 'Clip'}`}>
          <div className={styles.thumbnail}><Play size={24} />{video.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnail_url} alt={video.caption ?? 'Miniatura do clip'} loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} />
          )}{video.url && <span className={styles.playOverlay} aria-hidden="true"><Play size={16} fill="currentColor" /></span>}</div>
          <div className={styles.videoInfo}><div><p>{video.caption ?? 'Clip sem título'}</p><span className={styles.date}><CalendarDays size={10} />{shortDate(video.published_at)}</span></div>
            <div className={styles.videoFooter}><div><span><Eye size={12} />{compactNumber(video.latest_views)}</span><span><Heart size={12} />{compactNumber(video.latest_likes)}</span></div></div>
          </div>
        </button>})}</div>}
    </div>
    {selectedVideo && <TikTokPlayer video={selectedVideo} onClose={() => setSelectedVideo(null)}
      onPrevious={selectedIndex > 0 ? () => setSelectedVideo(videos[selectedIndex - 1]) : undefined}
      onNext={selectedIndex >= 0 && selectedIndex < videos.length - 1 ? () => setSelectedVideo(videos[selectedIndex + 1]) : undefined} />}
  </SettingsDrawer>
}

