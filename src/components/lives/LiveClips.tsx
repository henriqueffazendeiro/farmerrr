'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Eye, X } from 'lucide-react'
import { compactNumber } from '@/lib/format'
import { formatCount, type Live } from './scale'
import { topClipsForLive, type LiveClip } from './live-clips'
import styles from './live-clips.module.css'
import { ClipSocialIcon } from './clip-social-icon'

function ClipPreview({ clip, onClose }: { clip: LiveClip; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
  }, [])
  return <dialog ref={dialog} className={styles.preview} aria-labelledby={titleId} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
    <div className={styles.previewHeader}>
      <h2 id={titleId}>{clip.authorName}</h2>
      <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Fechar clip"><X size={20} /></button>
    </div>
    {clip.thumbnail && <div className={styles.previewImage}><Image src={clip.thumbnail} alt={clip.title} fill sizes="(max-width: 480px) 90vw, 400px" /></div>}
    <p>Clip de demonstração. Não tem vídeo associado.</p>
  </dialog>
}

export function LiveClips({ live, lives, month }: { live: Live; lives: Live[]; month: string }) {
  const [selectedClip, setSelectedClip] = useState<LiveClip | null>(null)
  const [period, setPeriod] = useState<'live' | 'month' | 'all'>('live')
  const selectionKey = `${period}:${month}:${live.date}`
  const [expanded, setExpanded] = useState({ key: '', limit: 4 })
  const limit = expanded.key === selectionKey ? expanded.limit : 4
  const allClips = period === 'live' ? topClipsForLive(live.clips ?? [], live.date, Infinity)
    : lives.filter(item => period === 'all' || item.date.startsWith(month)).flatMap(item => item.clips ?? [])
      .sort((a, b) => b.views - a.views || a.id.localeCompare(b.id))
  const clips = allClips.slice(0, limit)
  const labels = { live: 'desta live', month: 'deste mês', all: 'de sempre' }
  return <section className={styles.panel} aria-label={`Clips mais vistos ${labels[period]}`} data-live-date={live.date} data-period={period}>
    <div className={styles.filters} role="group" aria-label="Período dos clips">
      {([{ value: 'live', label: 'Esta live' }, { value: 'month', label: 'Este mês' }, { value: 'all', label: 'De sempre' }] as const).map(item =>
        <button type="button" key={item.value} aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}
    </div>
    {clips.length ? <div className={styles.grid}>
      {clips.map((clip, index) => <article className={styles.card} key={clip.id} data-clip-id={clip.id} data-views={clip.views}>
        <div className={styles.thumbnail}>
          {clip.thumbnail && <Image src={clip.thumbnail} alt={clip.title} fill sizes="(max-width: 520px) 90vw, (max-width: 980px) 45vw, 250px" />}
          <div className={styles.shade} />
          <div className={styles.badges}>
            {index === 0 && <span className={styles.topBadge}>#1</span>}
            <span className={styles.views} aria-label={`${formatCount(clip.views)} visualizações`}><Eye size={14} />{compactNumber(clip.views)}</span>
          </div>
          {clip.url
            ? <a className={styles.playOverlay} href={clip.url} target="_blank" rel="noopener noreferrer" aria-label={`Assistir: ${clip.title}`} />
            : <button type="button" className={styles.playOverlay} onClick={() => setSelectedClip(clip)} aria-label={`Abrir clip: ${clip.title}`} aria-haspopup="dialog" />}
          <div className={styles.metrics}>
            {([
              { label: 'gostos', value: clip.likes, icon: 'like' },
              { label: 'comentários', value: clip.comments, icon: 'comment' },
              { label: 'favoritos', value: clip.favorites, icon: 'favorite' },
              { label: 'partilhas', value: clip.shares, icon: 'share' },
            ] as const).map(metric => <span key={metric.label} aria-label={metric.value == null ? `${metric.label}: contagem indisponível` : `${formatCount(metric.value)} ${metric.label}`} title={metric.value == null ? 'Contagem indisponível' : metric.label}>
              <ClipSocialIcon name={metric.icon} />
              <span>{metric.value == null ? '—' : compactNumber(metric.value)}</span>
            </span>)}
          </div>
          <div className={styles.authorRow}>
            <span className={styles.author} title={`@${clip.author}`}>
              {clip.avatar && <Image src={clip.avatar} alt="" width={24} height={24} />}
              <strong>{clip.authorName}</strong>
            </span>
          </div>
        </div>
      </article>)}
    </div> : <p className={styles.empty}>Ainda não há clips {labels[period]}.</p>}
    {clips.length < allClips.length && <button type="button" className={styles.more} onClick={() => setExpanded({ key: selectionKey, limit: limit + 4 })}><span>Ver mais ({formatCount(allClips.length)})</span><ChevronDown size={16} aria-hidden="true" /></button>}
    {clips.length > 4 && <button type="button" className={styles.more} onClick={() => setExpanded({ key: selectionKey, limit: 4 })}><span>Ver menos</span><ChevronUp size={16} aria-hidden="true" /></button>}
    {selectedClip && <ClipPreview clip={selectedClip} onClose={() => setSelectedClip(null)} />}
  </section>
}
