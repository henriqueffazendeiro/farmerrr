'use client'

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Geist } from 'next/font/google'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Film } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { dateOf, dayAt, demoLives, formatCount, formatScore, scaleFor, scoreOf, withVote, type Live } from './scale'
import styles from './lives.module.css'
import { LiveClips } from './LiveClips'
import type { LiveClip } from './live-clips'
import { rateLive } from '@/lib/lives/actions'

const geist = Geist({ subsets: ['latin'], display: 'swap' })
const fixtures = demoLives()
const starPath = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z'

function Star() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={starPath} /></svg>
}

function Thumbnail({ live, small = false }: { live: Live; small?: boolean }) {
  return <div className={small ? styles.tipThumb : styles.thumb}>
    {live.thumbnail && <Image src={live.thumbnail} alt="" fill unoptimized sizes={small ? '72px' : '(max-width: 860px) 90vw, 340px'} />}
    {small ? <span className={styles.tipBadge} style={live.count ? { background: scaleFor(scoreOf(live)).bg, color: scaleFor(scoreOf(live)).fg } : undefined}>{live.count ? formatScore(scoreOf(live)) : '—'}</span> : <span className={styles.badge}>{live.isLive ? 'EM DIRETO' : live.platform ? 'LIVE' : 'VOD'}</span>}
  </div>
}

function StarRating({ value, onVote }: { value?: number; onVote: (value?: number) => void }) {
  const [hover, setHover] = useState(0)
  // Telemóvel: segurar e arrastar o dedo pelas estrelas; a nota fica ao levantar o dedo.
  const drag = useRef<{ id: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const shown = hover || value || 0

  function scoreAt(container: HTMLElement, x: number) {
    const buttons = Array.from(container.children) as HTMLElement[]
    const first = buttons[0].getBoundingClientRect(), last = buttons[buttons.length - 1].getBoundingClientRect()
    if (x <= first.left) return 1
    if (x >= last.right) return 10
    const index = buttons.findIndex(button => x < button.getBoundingClientRect().right)
    return Math.max(1, Math.min(10, index + 1))
  }

  return <>
    <div className={styles.rate} role="radiogroup" aria-label="Nota de 1 a 10 estrelas" onMouseLeave={() => setHover(0)}
      onPointerDown={event => {
        suppressClick.current = false
        if (event.pointerType === 'mouse') return
        drag.current = { id: event.pointerId, moved: false }
        setHover(scoreAt(event.currentTarget, event.clientX))
      }}
      onPointerMove={event => {
        if (drag.current?.id !== event.pointerId) return
        if (!drag.current.moved) { drag.current.moved = true; event.currentTarget.setPointerCapture(event.pointerId) }
        setHover(scoreAt(event.currentTarget, event.clientX))
      }}
      onPointerUp={event => {
        if (drag.current?.id !== event.pointerId) return
        const moved = drag.current.moved
        drag.current = null
        setHover(0)
        if (moved) { suppressClick.current = true; onVote(scoreAt(event.currentTarget, event.clientX)) }
      }}
      onPointerCancel={() => { drag.current = null; setHover(0) }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(score => <button key={score} type="button" role="radio" aria-label={`${score} de 10`} aria-checked={value === score}
        className={score <= shown ? styles.highlight : undefined} onMouseEnter={() => setHover(score)} onFocus={() => setHover(score)} onBlur={() => setHover(0)}
        onClick={() => { setHover(0); if (suppressClick.current) { suppressClick.current = false; return } onVote(score) }} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 1 : event.key === 'End' ? 10 : Math.max(1, Math.min(10, score + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1)))
          ;(event.currentTarget.parentElement?.children[next - 1] as HTMLButtonElement)?.focus()
          onVote(next)
        }}><Star /></button>)}
    </div>
  </>
}

/** Kick: sem ID da VOD na API, o link abre a lista de vídeos do canal. */
const vodLabel = (live: Live) => live.isLive ? 'Ver em direto' : live.platform === 'kick' ? 'Ver VODs na Kick' : 'Ver VOD'

type Tooltip = { live: Live; x: number; y: number }

function GridTooltip({ tooltip }: { tooltip: Tooltip | null }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!tooltip || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    const x = Math.max(8, Math.min(tooltip.x - width / 2, window.innerWidth - width - 8))
    const y = tooltip.y - height - 12 < 8 ? tooltip.y + 20 : tooltip.y - height - 12
    ref.current.style.transform = `translate(${x}px, ${Math.min(y, window.innerHeight - height - 8)}px)`
  }, [tooltip])
  return <div ref={ref} className={`${styles.tip} ${tooltip ? styles.tipOn : ''}`} aria-hidden="true">
    {tooltip && <div className={styles.tipRow}><div className={styles.tipPreview}>
      <Thumbnail live={tooltip.live} small />
      <span className={styles.tipLevel}>{tooltip.live.count ? scaleFor(scoreOf(tooltip.live)).label : 'Sem avaliações'}</span>
    </div><div>
      <div className={styles.tipTitle}>{tooltip.live.title}</div>
      <div className={styles.tipMeta}>{dateOf(tooltip.live.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })} · {formatCount(tooltip.live.count)} votos{tooltip.live.clipCount ? ` · ${formatCount(tooltip.live.clipCount)} ${tooltip.live.clipCount === 1 ? 'clip' : 'clips'}` : ''}</div>
    </div></div>}
  </div>
}

export function LivesView({ demo, initialLives = [], timezone = 'Europe/Lisbon', clips }: { demo: boolean; initialLives?: Live[]; timezone?: string; clips?: LiveClip[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const today = demo ? '2026-09-17' : new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  const requestedMonth = searchParams.get('mes')
  const initialMonth = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : today.slice(0, 7)
  const [month, setMonth] = useState(initialMonth)
  const [selected, setSelected] = useState<string | null>(null)
  const [votes, setVotes] = useState<Record<string, number | undefined>>({})
  // Lives reais: notas guardadas no servidor (atualizadas depois de cada voto, sem recarregar a página).
  const [ratings, setRatings] = useState<Record<string, Pick<Live, 'average' | 'count' | 'myVote'>>>({})
  const [voteError, setVoteError] = useState<{ id: string; message: string } | null>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const side = useRef<HTMLElement>(null)
  const lives = demo ? fixtures : initialLives
  const months = [...new Set(lives.map(live => live.date.slice(0, 7)))].sort()
  const monthLives = lives.filter(live => live.date.startsWith(month))
    .map(live => demo ? withVote(live, votes[live.date]) : live.id && ratings[live.id] ? { ...live, ...ratings[live.id] } : live)
  const live = monthLives.find(item => (item.id ?? item.date) === selected) ?? monthLives[monthLives.length - 1]
  const sameDayLives = live ? monthLives.filter(item => item.date === live.date) : []
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(year, monthNumber, 0).getDate()
  const previous = months.filter(value => value < month).at(-1)
  const next = months.find(value => value > month)

  useEffect(() => { setMonth(initialMonth); setSelected(null); setTooltip(null) }, [initialMonth])
  useEffect(() => {
    const hide = () => setTooltip(null)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide) }
  }, [])

  function goMonth(value?: string) {
    if (!value) return
    setMonth(value); setSelected(null); setTooltip(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', value)
    // Só atualiza o URL: os meses já estão todos no cliente, não é preciso voltar a renderizar a página no servidor.
    window.history.replaceState(null, '', `${pathname}?${params}#clips`)
  }

  function select(item: Live) {
    setSelected(item.id ?? item.date); setTooltip(null)
    if (window.matchMedia('(max-width: 980px)').matches) side.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }

  async function vote(item: Live, score?: number) {
    if (demo) { setVotes(current => ({ ...current, [item.date]: score })); return }
    if (!item.id || !score) return
    const id = item.id
    const previous = { average: item.average, count: item.count, myVote: item.myVote }
    setVoteError(null)
    setRatings(current => ({ ...current, [id]: { ...previous, myVote: score } }))
    const result = await rateLive(id, score).catch(() => ({ ok: false as const, error: 'Não foi possível guardar a nota. Tenta novamente.' }))
    if (result.ok) setRatings(current => ({ ...current, [id]: { average: result.average, count: result.count, myVote: result.myVote } }))
    else { setRatings(current => ({ ...current, [id]: previous })); setVoteError({ id, message: result.error }) }
  }

  function showTip(item: Live, x: number, y: number) {
    if (window.matchMedia('(hover: hover)').matches) setTooltip({ live: item, x, y })
  }

  return <section id="clips" aria-labelledby="lives-title" className={`${styles.section} ${geist.className}`}>
    <div className={styles.sectionHeader}>
      <h2 id="lives-title" className={styles.sectionTitle}><Film size={22} aria-hidden="true" />Absolute Cinema?</h2>
      <div className={styles.month}>
          <button type="button" className={styles.iconButton} aria-label="Mês anterior" disabled={!previous} onClick={() => goMonth(previous)}><ChevronLeft size={16} aria-hidden="true" /></button>
          <h2>{dateOf(`${month}-01`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</h2>
          <button type="button" className={styles.iconButton} aria-label="Mês seguinte" disabled={!next} onClick={() => goMonth(next)}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <div className={styles.layout}>
      <aside className={styles.side} ref={side}>
        {live ? <div className={styles.detail}>
          {live.vod ? <a href={live.vod} target="_blank" rel="noopener noreferrer" aria-label={vodLabel(live)} title={vodLabel(live)} className="block"><Thumbnail live={live} /></a> : <Thumbnail live={live} />}
          {live.open
            ? <div className={styles.voting}>
                <StarRating key={live.id ?? live.date} value={demo ? votes[live.date] : live.myVote} onVote={value => vote(live, value)} />
                {voteError && voteError.id === live.id && <p className={styles.voteError} role="alert">{voteError.message}</p>}
              </div>
            : <div className={styles.score}><Star /><strong>{live.count ? formatScore(scoreOf(live)) : '—'}</strong><span>{live.count ? `(${formatCount(live.count)})` : 'Sem avaliações'}</span></div>}
          <h3 className={styles.title} title={live.title}>{live.title}</h3>
          {sameDayLives.length > 1 && <select aria-label="Transmissão deste dia" value={live.id ?? live.date} className="my-2 w-full rounded border border-line bg-surface p-2" onChange={event => setSelected(event.target.value)}>
            {sameDayLives.map(item => <option key={item.id ?? item.date} value={item.id ?? item.date}>{item.platform ? `${item.platform} · ` : ''}{item.title}</option>)}
          </select>}
          <div className={styles.date}>{dateOf(live.date).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          {!live.open && <p className={styles.closed}>{demo || live.count ? 'A votação desta live já fechou.' : live.isLive ? 'Esta transmissão está em direto.' : 'Transmissão terminada.'}</p>}
          {live.vod && <a className={styles.vod} href={live.vod} target="_blank" rel="noopener noreferrer">{vodLabel(live)}</a>}
        </div> : <p className={styles.closed}>Este mês ainda não tem lives. Escolhe outro mês.</p>}
      </aside>
      <div className={styles.gridSide}>
        <div className={styles.gridBox}>
          <div className={styles.scroller}>
            <div className={styles.grid} aria-label="Lives por dia do mês" onMouseLeave={() => setTooltip(null)}>
              <div />{Array.from({ length: 5 }, (_, week) => <div key={week} className={styles.heading}>S{week + 1}</div>)}
              {Array.from({ length: 7 }, (_, row) => <Fragment key={row}>
                <div className={styles.heading}>{row + 1}</div>
                {Array.from({ length: 5 }, (_, week) => {
                  const day = dayAt(week, row)
                  const date = `${month}-${String(day).padStart(2, '0')}`
                  const dayLives = monthLives.filter(value => value.date === date)
                  const item = dayLives.find(value => value.isLive) ?? dayLives.at(-1)
                  if (day > days) return <div key={week} className={`${styles.cell} ${styles.out}`} aria-hidden="true" />
                  if (date > today) return <div key={week} className={`${styles.cell} ${styles.future}`} title={`Dia ${day} — ainda não aconteceu`}>·</div>
                  if (!item) return <div key={week} className={`${styles.cell} ${styles.none}`} title={`Dia ${day} — sem live`}>—</div>
                  const color = scaleFor(scoreOf(item))
                  return <button key={week} type="button" className={styles.cell} style={item.count ? { background: color.bg, color: color.fg } : { background: '#242832', color: '#fff' }}
                    aria-label={`Dia ${day}: ${dayLives.length} transmissão, ${item.title}${item.isLive ? ', em direto' : ''}`} aria-pressed={live?.date === item.date}
                    onClick={() => select(item)} onMouseMove={event => showTip(item, event.clientX, event.clientY)} onFocus={event => {
                      if (!event.currentTarget.matches(':focus-visible')) return
                      const rect = event.currentTarget.getBoundingClientRect()
                      showTip(item, rect.left + rect.width / 2, rect.top)
                    }} onBlur={() => setTooltip(null)}>{item.count ? formatScore(scoreOf(item)) : item.isLive ? '●' : <Film size={16} aria-hidden="true" />}</button>
                })}
              </Fragment>)}
            </div>
          </div>
        </div>
      </div>
    </div>
    <LiveClips live={live} lives={lives} month={month} today={today} clips={demo ? undefined : clips} />
    <GridTooltip tooltip={tooltip} />
  </section>
}
