'use client'

import { useLayoutEffect, useRef } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import styles from './tiktok-player.module.css'

type PlayerVideo = { provider_video_id?: string; url: string | null; caption: string | null }

export function TikTokPlayer({ video, onClose, onPrevious, onNext }: { video: PlayerVideo; onClose: () => void; onPrevious?: () => void; onNext?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const videoId = video.provider_video_id && /^\d+$/.test(video.provider_video_id) ? video.provider_video_id : video.url?.match(/\/(?:video|embed\/v2|player\/v1)\/(\d+)/)?.[1]
  // Vídeos inventados da página de demonstração: não há TikTok para mostrar.
  const isDemo = /^(demo|ficticio)-/.test(video.provider_video_id ?? '')
  const externalUrl = isDemo ? null : video.url ?? (videoId ? `https://www.tiktok.com/@_/video/${videoId}` : null)

  useLayoutEffect(() => {
    const element = dialog.current
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    element?.showModal()
    return () => {
      element?.close()
      document.documentElement.style.overflow = previousOverflow
    }
  }, [])

  return <dialog ref={dialog} className={styles.dialog} aria-label="Vídeo do TikTok"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose() }}>
    <div className={styles.content}>
      <div className={styles.videoFrame}>
      {isDemo ? <div className={styles.demo}><strong>Isto é um demo</strong><span>Numa página real, o TikTok do clipper aparece aqui.</span></div>
        : videoId ? <iframe key={videoId} className={styles.player}
        src={`https://www.tiktok.com/player/v1/${videoId}?autoplay=1&rel=0`}
        title={video.caption ?? 'Vídeo do TikTok'} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
        : <p className={styles.unavailable}>Não foi possível carregar este vídeo.</p>}
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.control} onClick={onClose} aria-label="Fechar vídeo" title="Fechar vídeo" autoFocus><X size={20} /></button>
        <div className={styles.navigation}>
          <button type="button" className={styles.control} onClick={onPrevious} disabled={!onPrevious} aria-label="Vídeo anterior" title="Vídeo anterior"><ChevronUp size={24} /></button>
          <button type="button" className={styles.control} onClick={onNext} disabled={!onNext} aria-label="Vídeo seguinte" title="Vídeo seguinte"><ChevronDown size={24} /></button>
        </div>
        {externalUrl ? <a className={styles.control} href={externalUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir no TikTok" title="Abrir no TikTok">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.7 1h-3.5v14.8a3.1 3.1 0 1 1-2.7-3.1V9.1a6.7 6.7 0 1 0 6.2 6.7V8.3a9.1 9.1 0 0 0 5.3 1.7V6.5A5.5 5.5 0 0 1 16.7 1Z" /></svg>
        </a> : <span />}
      </div>
    </div>
  </dialog>
}
