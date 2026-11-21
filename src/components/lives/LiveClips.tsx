'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Eye, X } from 'lucide-react'
import { compactNumber } from '@/lib/format'
import { formatCount, type Live } from './scale'
import { topClipsForLive, type LiveClip } from './live-clips'
import styles from './live-clips.module.css'
import { ClipSocialIcon } from './clip-social-icon'
import { TikTokPlayer } from '@/components/leaderboard/tiktok-player'

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

type Period = 'live' | 'week' | 'month' | 'all'

/** Semana (segunda a domingo) que contém `date` (AAAA-MM-DD), como datas AAAA-MM-DD. */
function weekRange(date: string): [string, string] {
  const day = new Date(`${date}T00:00:00Z`)
  const monday = new Date(day)
  monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)]
}

/**
 * Mural dos clips. `tracked` são os clips reais dos clippers (vídeos do ranking);
 * sem eles (demonstração) usa os clips associados às lives.
 */
/** Mostra exatamente 2 filas de clips; o resto vê-se com scroll dentro da caixa. */
function useTwoRows(resetKey: string) {
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  const [atEnd, setAtEnd] = useState(true)
  useLayoutEffect(() => {
    const element = box.current
    const grid = element?.firstElementChild as HTMLElement | null
    if (!element || !grid) return
    element.scrollTop = 0
    const update = () => {
      const cards = [...grid.children] as HTMLElement[]
      const first = cards[0]
      if (!first) return
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0
      const twoRows = Math.ceil(first.offsetHeight * 2 + gap)
      setHeight(twoRows)
      setAtEnd(grid.offsetHeight <= twoRows + 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [resetKey])
  const onScroll = () => {
    const element = box.current
    if (element) setAtEnd(element.scrollTop + element.clientHeight >= element.scrollHeight - 2)
  }
  return { box, height, atEnd, onScroll }
}

export function LiveClips({ live, lives, month, today, clips: tracked }: { live?: Live; lives: Live[]; month: string; today: string; clips?: LiveClip[] }) {
  const [selectedClip, setSelectedClip] = useState<LiveClip | null>(null)
  const [chosen, setChosen] = useState<Period | null>(null)
  const byViews = (a: LiveClip, b: LiveClip) => b.views - a.views || a.id.localeCompare(b.id)
  // A semana é a da live mostrada (ou a atual, se não houver live).
  const [weekStart, weekEnd] = weekRange(live?.date ?? today)
  const inPeriod = (date: string, value: Period) => value === 'all' ? true
    : value === 'week' ? date.slice(0, 10) >= weekStart && date.slice(0, 10) <= weekEnd
    : date.startsWith(month)
  const clipsFor = (value: Period): LiveClip[] => value === 'live' ? (live ? topClipsForLive(live.clips ?? [], live.date, Infinity) : [])
    : tracked ? tracked.filter(clip => inPeriod(clip.publishedAt, value)).sort(byViews)
    : lives.filter(item => inPeriod(item.date, value)).flatMap(item => item.clips ?? []).sort(byViews)
  // Até o visitante escolher, abre no primeiro separador que tenha clips.
  const period: Period = chosen ?? (['live', 'week', 'month', 'all'] as const).find(value => clipsFor(value).length > 0) ?? 'live'
  const setPeriod = (value: Period) => setChosen(value)
  const selectionKey = `${period}:${month}:${weekStart}:${live?.date ?? ''}`
  const clips = clipsFor(period)
  const playableClips = clips.filter(clip => clip.url || clip.providerVideoId)
  const selectedIndex = selectedClip ? playableClips.findIndex(clip => clip.id === selectedClip.id) : -1
  const rows = useTwoRows(`${selectionKey}:${clips.length}`)
  const labels = { live: 'desta live', week: 'desta semana', month: 'deste mês', all: 'de sempre' }
  return <section className={styles.panel} aria-label={`Clips mais vistos ${labels[period]}`} data-live-date={live?.date} data-period={period}>
    <div className={styles.filters} role="group" aria-label="Período dos clips">
      {([{ value: 'live', label: 'Esta live', short: 'Live' }, { value: 'week', label: 'Esta semana', short: 'Semana' }, { value: 'month', label: 'Este mês', short: 'Mês' }, { value: 'all', label: 'De sempre', short: 'Sempre' }] as const).map(item =>
        <button type="button" key={item.value} aria-pressed={period === item.value} aria-label={item.label} onClick={() => setPeriod(item.value)}>
          <span className={styles.longLabel}>{item.label}</span><span className={styles.shortLabel} aria-hidden="true">{item.short}</span>
        </button>)}
    </div>
    {clips.length ? <div ref={rows.box} className={styles.scroller} data-at-end={rows.atEnd} onScroll={rows.onScroll} style={{ maxHeight: rows.height }}><div className={styles.grid}>
      {clips.map((clip, index) => <article className={styles.card} key={clip.id} data-clip-id={clip.id} data-views={clip.views}>
        <div className={styles.thumbnail}>
          {clip.thumbnail && <Image src={clip.thumbnail} alt={clip.title} fill unoptimized sizes="(max-width: 520px) 90vw, (max-width: 980px) 45vw, 250px" />}
          <div className={styles.shade} />
          <div className={styles.badges}>
            {index === 0 && <span className={styles.topBadge}>#1</span>}
            <span className={styles.views} aria-label={`${formatCount(clip.views)} visualizações`}><Eye size={14} />{compactNumber(clip.views)}</span>
          </div>
          <button type="button" className={styles.playOverlay} onClick={() => setSelectedClip(clip)} aria-label={`Assistir: ${clip.title}`} aria-haspopup="dialog" />
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
              {clip.avatar && <Image src={clip.avatar} alt="" width={24} height={24} unoptimized />}
              <strong>{clip.authorName}</strong>
            </span>
          </div>
        </div>
      </article>)}
    </div></div> : <p className={styles.empty}>Ainda não há clips {labels[period]}.</p>}
    {selectedClip && (selectedClip.url || selectedClip.providerVideoId
      ? <TikTokPlayer video={{ provider_video_id: selectedClip.providerVideoId, url: selectedClip.url, caption: selectedClip.title }} onClose={() => setSelectedClip(null)}
        onPrevious={selectedIndex > 0 ? () => setSelectedClip(playableClips[selectedIndex - 1]) : undefined}
        onNext={selectedIndex >= 0 && selectedIndex < playableClips.length - 1 ? () => setSelectedClip(playableClips[selectedIndex + 1]) : undefined} />
      : <ClipPreview clip={selectedClip} onClose={() => setSelectedClip(null)} />)}
  </section>
}
