'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Maximize2, RotateCcw, X } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { periodLabel } from '@/lib/period'
import { summarizeRecap, type MonthlyRecap } from '@/lib/recap/model'
import { RECAP_TRANSITION_MS, useRecapNavigation } from './use-recap-navigation'
import styles from './recap.module.css'

// The visual preview deliberately ends with views. Later chapters use the same stage.
const scenes = [
  { id: 'opening', label: 'A abertura' },
  { id: 'anticipation', label: 'O que vocês fizeram' },
  { id: 'views', label: 'O alcance' },
] as const
const format = (value: number) => Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const variable = (i: number) => ({ '--i': i } as CSSProperties)

function Opening() {
  return <div className={styles.opening}>
    <div className={styles.openingGraphics} aria-hidden="true">
      <div className={styles.wrappedFlower}>
        <svg viewBox="0 0 400 400">
          {Array.from({ length: 10 }, (_, i) => <ellipse key={i} cx="200" cy="104" rx="48" ry="100" transform={`rotate(${i * 36} 200 200)`} />)}
          <circle cx="200" cy="200" r="66" />
        </svg>
      </div>
      <div className={styles.wrappedTunnel}>
        {Array.from({ length: 7 }, (_, i) => <i key={i} style={variable(i)} />)}
      </div>
      <div className={styles.wrappedSteps}>
        {Array.from({ length: 6 }, (_, i) => <i key={i} style={variable(i)} />)}
      </div>
      <div className={styles.wrappedStar}>
        <svg viewBox="0 0 200 200"><path d="M100 0 117 58 171 29 142 83 200 100 142 117 171 171 117 142 100 200 83 142 29 171 58 117 0 100 58 83 29 29 83 58Z" /></svg>
      </div>
    </div>
    <div className={styles.titleBlock}>
      <h1 className={styles.openingTitle}><span>RECAP DE</span> AGOSTO</h1>
      <div className={styles.brand} aria-label="FarmeRRR">
        <span className="inline-flex h-10 items-center whitespace-nowrap text-[24px] font-semibold tracking-[-0.04em] text-white select-none">
          <span className="inline-flex items-baseline gap-[5px] leading-none">
            <span>farme</span><span className="shrink-0 rounded-sm bg-white px-[5px] py-[3px] text-black">rrr.</span>
          </span>
        </span>
      </div>
    </div>
  </div>
}

function Anticipation() {
  return <div className={styles.anticipation}>
    <div className={styles.ribbonEntrance} aria-hidden="true">
      {[0, 1].map(bank => <div className={styles.ribbonBank} key={bank}>
        {Array.from({ length: 3 }, (_, i) => <div className={styles.ribbonLane} key={i} style={variable(i + bank * 3)}>
          {Array.from({ length: 9 }, (_, j) => <i key={j} />)}
        </div>)}
      </div>)}
    </div>
    <h1 className={styles.statement}><span>VOCÊS CLIPARAM.</span><span>NÓS CONTÁMOS.</span></h1>
  </div>
}

function Views({ total, reduced }: { total: number; reduced: boolean }) {
  const number = useRef<HTMLSpanElement>(null)
  const field = useRef<HTMLDivElement>(null)
  const [landed, setLanded] = useState(reduced)

  useEffect(() => {
    if (reduced) {
      if (number.current) number.current.textContent = format(total)
      field.current?.style.setProperty('--charge', '0')
      setLanded(true)
      return
    }
    let frame = 0
    let start: number | null = null
    setLanded(false)
    const tick = (now: number) => {
      start ??= now
      const progress = Math.min(1, Math.max(0, (now - start - 350) / 2800))
      const value = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
      if (number.current) number.current.textContent = format(total * value)
      // The field opens up with the speed of the count, then returns to its idle rhythm.
      field.current?.style.setProperty('--charge', String(Math.sin(progress * Math.PI)))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else setLanded(true)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [total, reduced])

  return <div ref={field} className={styles.views} data-landed={landed}>
    <div className={styles.burstEnvelope} aria-hidden="true">
      <div className={styles.burst}>{Array.from({ length: 36 }, (_, i) =>
        <span key={i} style={variable(i)}><i /></span>)}
      </div>
    </div>
    <div className={styles.shockwave} aria-hidden="true" />
    <h1 className={styles.statistic} aria-label={`${format(total)} views`}>
      <span ref={number} aria-hidden="true" className={styles.number}
        style={{ fontSize: `${Math.min(18, 156 / format(total).length)}cqw` }}>
        {reduced ? format(total) : '0'}
      </span>
      <span className={styles.unit} aria-hidden="true">VIEWS</span>
    </h1>
  </div>
}

export function RecapExperience({ slug, recap }: { slug: string; recap: MonthlyRecap | null }) {
  const [notice, setNotice] = useState('')
  const [controlsVisible, setControlsVisible] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = useRef<HTMLElement>(null)
  const reduced = Boolean(useReducedMotion())
  const { scene, run, direction, transitioning, travel, go, navigate, replay } = useRecapNavigation(scenes.length, reduced)
  const total = useMemo(() => summarizeRecap(recap?.snapshot ?? { videos: [] }).totals.views, [recap])
  const edition = recap ? `${periodLabel(recap.period_key)} ${recap.period_key.slice(0, 4)}` : ''

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setControlsVisible(false), 1600)
  }, [])

  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current) }, [])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  useEffect(() => {
    const update = () => root.current?.setAttribute('data-paused', String(document.hidden))
    document.addEventListener('visibilitychange', update)
    update()
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await root.current?.requestFullscreen()
    } catch { setNotice('Usa F11 para abrir em ecrã inteiro neste navegador.') }
  }

  return <main ref={root} className={styles.viewport} aria-label={`FarmeRRR Monthly Recap ${edition}`}>
    <div className={styles.stage} data-scene={scenes[scene].id}
      data-controls={controlsVisible ? 'visible' : 'hidden'}
      onPointerMove={showControls} onPointerDown={showControls} onPointerLeave={() => setControlsVisible(false)}
      style={{ '--transition-duration': `${RECAP_TRANSITION_MS - 100}ms` } as CSSProperties}>
      {!recap ? <div className={styles.empty}>
        <h1>O próximo grande<br />momento está a chegar.</h1>
        <Link href={`/${slug}`}>Voltar à comunidade <ArrowRight size={18} /></Link>
      </div> : <>
        <div key={`${scene}-${run}`} className={styles.scene} role="group" aria-label={scenes[scene].label}>
          {scene === 0 && <Opening />}
          {scene === 1 && <Anticipation />}
          {scene === 2 && <Views total={total} reduced={reduced} />}
        </div>
        {transitioning && <div className={styles.transition} data-direction={direction}
          data-kind={travel.from === 0 || travel.to === 0 ? 'circle' : 'bars'}
          data-to={scenes[travel.to].id} aria-hidden="true"><i /><i /><i /></div>}
        <div className={styles.utilities}>
          <button onClick={fullscreen} aria-label="Alternar ecrã inteiro" title="Ecrã inteiro"><Maximize2 /></button>
          <Link href={`/${slug}`} aria-label="Fechar Recap" title="Voltar à comunidade"><X /></Link>
        </div>
        <nav className={styles.navigation} aria-label="Navegação do Recap">
          <button className={`${styles.edge} ${styles.previousEdge}`} disabled={scene === 0 || transitioning}
            onClick={() => go(-1)} aria-label="Cena anterior"><ArrowLeft /></button>
          <button className={`${styles.edge} ${styles.nextEdge}`} disabled={scene === scenes.length - 1 || transitioning}
            onClick={() => go(1)} aria-label="Cena seguinte"><ArrowRight /></button>
          <div className={styles.progress}>{scenes.map(({ id, label }, i) =>
            <button key={id} aria-label={label} aria-current={i === scene ? 'step' : undefined}
              aria-disabled={transitioning} onClick={() => navigate(i)}><span /></button>)}
          </div>
          {scene === scenes.length - 1 && <button className={styles.replay} onClick={replay}
            disabled={transitioning} aria-label="Rever início" title="Rever início"><RotateCcw /></button>}
        </nav>
        <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
          Cena {scene + 1} de {scenes.length}: {scenes[scene].label}
        </span>
      </>}
      {notice && <button className={styles.notice} onClick={() => setNotice('')} role="status">{notice} ×</button>}
    </div>
  </main>
}
