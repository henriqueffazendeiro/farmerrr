'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ExternalLink, Eye, Film, Flame, Heart, Play, Users, X } from 'lucide-react'
import type { ClipperRow, VideoRow } from '@/lib/db/board'
import { compactNumber, shortDate } from '@/lib/format'
import { ALL_TIME } from '@/lib/period'
import { getClipperDetails } from './clipper-details-action'
import styles from './clipper-dialog.module.css'

export function ClipperDialog({ clipper, slug, periodKey, onClose }: { clipper: ClipperRow; slug: string; periodKey: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [details, setDetails] = useState<{ clipper: ClipperRow; videos: VideoRow[] } | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    let active = true
    getClipperDetails(slug, clipper.participantId, periodKey).then(result => {
      if (active) setDetails(result)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [slug, clipper.participantId, periodKey, attempt])

  const row = details?.clipper ?? clipper
  const videos = details?.videos ?? []
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="clipper-dialog-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.avatar}>{row.avatarUrl && !avatarFailed ?
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.avatarUrl} alt={row.displayName} onError={() => setAvatarFailed(true)} /> : row.displayName.slice(0, 2).toUpperCase()}</span>
          <div><h2 id="clipper-dialog-title">{row.displayName}</h2>{row.username && <a href={`https://www.tiktok.com/@${encodeURIComponent(row.username)}`} target="_blank" rel="noreferrer">@{row.username} <ExternalLink size={12} /></a>}</div>
        </div>
        <button autoFocus className={styles.close} onClick={() => dialog.current?.close()} aria-label="Fechar perfil"><X size={16} /></button>
      </header>
      <div className={styles.stats}>
        {[{ label: periodKey === ALL_TIME ? 'Views Totais' : 'Views no Mês', value: compactNumber(row.totalViews), icon: Eye },
          { label: 'Média / TikTok', value: `~${compactNumber(row.avgViews)}`, icon: Flame, featured: true },
          { label: 'Likes', value: compactNumber(row.totalLikes), icon: Heart },
          { label: 'Seguidores', value: row.followerCount == null ? '—' : compactNumber(row.followerCount), icon: Users },
          { label: 'Vídeos', value: row.videoCount, icon: Film }].map(stat => <div key={stat.label} className={`${styles.stat} ${stat.featured ? styles.featured : ''}`}><span><stat.icon size={14} />{stat.label}</span><strong>{stat.value}</strong></div>)}
      </div>
      <div className={styles.content} aria-busy={!details && !error}>
        <div className={styles.listHeader}><h3>Clipes Rastreados{details ? ` (${videos.length})` : ''}</h3><span>Ordenados por visualizações</span></div>
        {error ? <div className={styles.empty} role="alert">Não foi possível carregar os clips.<button onClick={() => { setError(false); setAttempt(value => value + 1) }}>Tentar novamente</button></div> : !details ? <p className={styles.empty} role="status">A carregar clips...</p> : videos.length === 0 ? <p className={styles.empty}>Nenhum vídeo rastreado para esta conta neste período.</p> :
          <div className={styles.grid}>{videos.map(video => <article key={video.id} className={styles.video}>
            <div className={styles.thumbnail}><Play size={24} />{video.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnail_url} alt={video.caption ?? 'Miniatura do clip'} loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} />
            )}{video.url && <a href={video.url} target="_blank" rel="noreferrer" aria-label={`Assistir: ${video.caption ?? 'Clip'}`}><Play size={16} fill="currentColor" /></a>}</div>
            <div className={styles.videoInfo}><div><p>{video.caption ?? 'Clip sem título'}</p><span className={styles.date}><CalendarDays size={10} />{shortDate(video.published_at)}</span></div>
              <div className={styles.videoFooter}><div><span><Eye size={12} />{compactNumber(video.latest_views)}</span><span><Heart size={12} />{compactNumber(video.latest_likes)}</span></div>{video.url && <a href={video.url} target="_blank" rel="noreferrer">Abrir <ExternalLink size={10} /></a>}</div>
            </div>
          </article>)}</div>}
      </div>
    </div>
  </dialog>
}
