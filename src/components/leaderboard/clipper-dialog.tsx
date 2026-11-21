'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, ExternalLink, Eye, Film, Gift, Heart, Play, Users } from 'lucide-react'
import type { ClipperRow, VideoRow } from '@/lib/db/board'
import { compactNumber, money, shortDate } from '@/lib/format'
import { ALL_TIME } from '@/lib/period'
import { SettingsDrawer } from '@/components/dashboard/settings-drawer'
import { cachedClipperDetails, loadClipperDetails, type ClipperDetails } from './clipper-details-cache'
import styles from './clipper-dialog.module.css'
import { TikTokPlayer } from './tiktok-player'

function DiscordIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.32 4.37A19.8 19.8 0 0 0 15.4 2.85a.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.07 0a.07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.1c.36.7.78 1.36 1.23 2a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z" /></svg>
}

/** Perfil do clipper, no mesmo painel lateral do "Participar". */
export function ClipperDialog({ clipper, slug, periodKey, onClose }: { clipper: ClipperRow; slug: string; periodKey: string; onClose: () => void }) {
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
    <div className={styles.drawerIdentity}>
      <span className={styles.avatar}>{row.avatarUrl && !avatarFailed ?
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.avatarUrl} alt={row.displayName} onError={() => setAvatarFailed(true)} /> : row.displayName.slice(0, 2).toUpperCase()}</span>
      <div className={styles.handles}>
        {row.username && <a href={`https://www.tiktok.com/@${encodeURIComponent(row.username)}`} target="_blank" rel="noreferrer">@{row.username} <ExternalLink size={12} /></a>}
        {details?.discord && <span className={styles.discord} title="Discord"><DiscordIcon />{details.discord}</span>}
      </div>
    </div>
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
