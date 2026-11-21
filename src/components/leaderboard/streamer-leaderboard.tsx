'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useOptimistic, useRef, useState, useTransition, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LivesView } from '@/components/lives/LivesView'
import type { Live } from '@/components/lives/scale'
import type { LiveClip } from '@/components/lives/live-clips'
import { Clock, Eye, Film, Gift, Heart, Settings, Users } from 'lucide-react'
import type { DuePrize } from '@/lib/prizes/model'
import { PrizeDueBanner, PrizeStatusBanner } from '@/components/prizes/prize-due'
import type { Creator, Leaderboard, Reward } from '@/lib/db/types'
import type { ClipperRow } from '@/lib/db/board'
import { ALL_TIME, periodLabel } from '@/lib/period'
import { compactNumber, fullNumber, money } from '@/lib/format'
import { AutoRefresh } from './auto-refresh'
import { AnimatedNumber } from './animated-number'
import { PrizeAmount } from './prize-amount'
import { Laurel } from './laurel'
import styles from './streamer-leaderboard.module.css'
import summary from './competition-summary.module.css'
import ranking from './ranking.module.css'
import { ClipperDialog } from './clipper-dialog'
import { SettingsDrawer } from '@/components/dashboard/settings-drawer'
import type { JoinFormProps } from './join-form'
import { loadClipperDetails } from './clipper-details-cache'

type Dataset = { clippers: ClipperRow[]; totals: Props['totals'] }

type Props = {
  leaderboard: Leaderboard
  /** Dados de todos os períodos, para trocar de separador sem ir ao servidor. */
  datasets?: Record<string, Dataset>
  join?: Omit<JoinFormProps, 'erro' | 'panel'>
  creator: Creator | null
  clippers: ClipperRow[]
  totals: { total_views: number; total_clips: number; active_clippers: number; total_likes: number; avg_views: number }
  rewards: Reward[]
  periods: string[]
  periodKey: string
  sort: 'views' | 'media'
  demo: boolean
  isLive?: boolean
  isOwner?: boolean
  settingsContent?: ReactNode
  lives?: Live[]
  /** Clips reais dos clippers, para o mural por baixo do Absolute Cinema. */
  clips?: LiveClip[]
  /** Só para o dono: prémios do mês que acabou, por entregar. Ocupa o lugar do contador até serem pagos. */
  prizeDue?: DuePrize | null
  /** Prémios do período a decorrer: aparecem no lugar do contador assim que ele chega a zero. */
  prizeNext?: DuePrize | null
  /** Fim da corrida atual (fim do mês nas competições mensais). */
  clockTarget?: string | null
  /** Clipper que já participa nesta competição: as definições dele (no lugar do "Participar"). */
  clipperSettings?: ReactNode
  /** Abre as definições logo ao carregar (ex.: um aviso do levantamento para o clipper ler). */
  settingsOpen?: boolean
  /** Competição em pausa (acabou, a seguinte ainda não começou): retângulo no lugar do contador. */
  pause?: { eyebrow: string; title: string; text: string } | null
  /** Quando pedir a página de novo ao servidor (o dia em que começa a competição seguinte). */
  refreshAt?: string | null
}

function Portrait({ src, name, className = '' }: { src: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <span className={`${styles.portrait} ${className}`}>
    {src && !failed ?
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} onError={() => setFailed(true)} /> :
      <span>{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</span>}
  </span>
}

function PodiumSurface({ place }: { place: number }) {
  const id = useId().replace(/:/g, '')
  const gold = place === 1
  // The rear corners project towards one vanishing point above the centre podium.
  const depth = gold ? 24 : place === 2 ? 32 : 36
  const left = gold ? 19 : place === 2 ? 56 : -19
  const right = gold ? 151 : place === 2 ? 189 : 114
  const outline = `M0 ${depth} L${left} 0 H${right} L170 ${depth} Z`
  return <svg className={ranking.podiumSurface} viewBox="0 0 170 190" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-face`} x2="0" y2="1">
        <stop stopColor={gold ? '#35332a' : '#29292e'} />
        <stop offset="1" stopColor="#09090b" />
      </linearGradient>
      <linearGradient id={`${id}-top`} x2="0" y2="1">
        <stop stopColor={gold ? '#49432b' : '#34343a'} />
        <stop offset="1" stopColor={gold ? '#2f2d25' : '#242428'} />
      </linearGradient>
      <linearGradient id={`${id}-edge`} x2="0" y2="1">
        <stop stopColor={gold ? '#ffe783' : '#666670'} stopOpacity={gold ? 1 : .5} />
        <stop offset=".75" stopColor={gold ? '#ffe783' : '#666670'} stopOpacity="0" />
      </linearGradient>
      <filter id={`${id}-glow`} x="-50%" y="-100%" width="200%" height="300%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
    <path d={`M0 ${depth} H170 V190 H0 Z`} fill={`url(#${id}-face)`} />
    <path d={outline} fill={`url(#${id}-top)`} />
    {gold && <g fill="none" stroke="#ffdf63" strokeWidth="3" filter={`url(#${id}-glow)`} opacity=".85">
      <path d={outline} />
      <path d={`M0 ${depth} V190 M170 ${depth} V190`} stroke={`url(#${id}-edge)`} />
    </g>}
    <path d={outline} fill="none" stroke={gold ? '#ffe783' : '#64646e'} strokeWidth={gold ? 1.15 : .65} vectorEffect="non-scaling-stroke" />
    <path d={`M0 ${depth} V190 M170 ${depth} V190`} fill="none" stroke={`url(#${id}-edge)`} strokeWidth={gold ? 1.2 : .7} vectorEffect="non-scaling-stroke" />
  </svg>
}

/**
 * Anima as linhas quando a ordem muda (técnica FLIP): cada linha começa na posição
 * antiga e desliza até à nova. Quem sobe passa por cima de quem desce.
 */
function useRankingFlip(order: string) {
  const body = useRef<HTMLTableSectionElement>(null)
  // Guarda a POSIÇÃO NA LISTA (índice) de cada clipper, não píxeis: assim só anima
  // quem realmente trocou de lugar, e nunca por causa de mudanças de layout ao carregar.
  const previous = useRef<Map<string, number> | null>(null)
  useLayoutEffect(() => {
    const element = body.current
    if (!element) return
    const rows = [...element.querySelectorAll<HTMLTableRowElement>('tr[data-id]')]
    const before = previous.current
    previous.current = new Map(rows.map((row, index) => [row.dataset.id!, index]))
    if (!before || document.visibilityState !== 'visible' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tops = rows.map(row => row.offsetTop)
    rows.forEach((row, index) => {
      const oldIndex = before.get(row.dataset.id!)
      // Novo na lista, ou ficou no mesmo lugar: sem animação.
      if (oldIndex === undefined || oldIndex === index || oldIndex >= rows.length) return
      const delta = tops[oldIndex] - tops[index]
      row.getAnimations().forEach(animation => animation.cancel())
      row.dataset.moving = oldIndex > index ? 'up' : 'down'
      const slide = row.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }],
        { duration: 620, easing: 'cubic-bezier(.22, 1, .36, 1)' })
      const done = () => { delete row.dataset.moving }
      slide.onfinish = done
      slide.oncancel = done
    })
  }, [order])
  return body
}

function CompetitionClock({ target, onEnd }: { target: string; onEnd?: () => void }) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const router = useRouter()
  const wasRunning = useRef(false)
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(target).getTime() - Date.now()))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [target])
  // Chegou a zero com a página aberta: pede ao servidor o estado novo (o "Entregar prémios" e o contador do mês seguinte).
  useEffect(() => {
    if (remaining === null) return
    if (remaining > 0) { wasRunning.current = true; return }
    if (!wasRunning.current) return
    wasRunning.current = false
    onEnd?.()
    const timer = setTimeout(() => router.refresh(), 800)
    return () => clearTimeout(timer)
  }, [remaining, router, onEnd])
  const seconds = Math.floor((remaining ?? 0) / 1000)
  const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60]
  return <div className={summary.countdown}>
    {/* Em zero fica 00:00 por instantes, até chegar o contador seguinte (ou o "Entregar prémios"). */}
    <div className={summary.clock}>
      {['dias', 'horas', 'min', 'seg'].map((unit, i) => <div key={unit} className={summary.clockUnit}>
        {i > 0 && <span className={summary.clockSeparator} aria-hidden>:</span>}
        <strong>{remaining === null ? '--' : String(values[i]).padStart(2, '0')}</strong><span>{unit}</span>
      </div>)}
    </div>
  </div>
}

export function StreamerLeaderboard({ leaderboard: lb, datasets, creator, clippers: serverClippers, totals: serverTotals, rewards, periods, periodKey: serverPeriodKey, demo, isLive, isOwner = false, settingsContent, lives = [], clips = [], prizeDue, prizeNext, clockTarget, clipperSettings, settingsOpen: openSettingsFirst = false, pause, refreshAt }: Props) {
  const router = useRouter()
  // Em pausa: no dia em que começa a competição seguinte, pede a página nova ao servidor.
  useEffect(() => {
    if (!refreshAt) return
    const wait = Date.parse(refreshAt) - Date.now() + 1000
    if (!(wait > 0) || wait > 2_000_000_000) return
    const timer = setTimeout(() => router.refresh(), wait)
    return () => clearTimeout(timer)
  }, [refreshAt, router])
  // O contador que chegou a zero (quando o servidor manda o do mês seguinte, deixa de contar como terminado).
  // clockTarget null: sem contador (competição de data fixa que já acabou).
  const clockFor = clockTarget !== undefined ? clockTarget : lb.ends_at
  const [endedClock, setEndedClock] = useState<string | null>(null)
  const endClock = useCallback(() => setEndedClock(clockFor), [clockFor])
  const shownPrize = prizeDue ?? (endedClock != null && endedClock === clockFor ? prizeNext : null)
  const [settingsOpen, setSettingsOpen] = useState(openSettingsFirst)
  // O aviso fica nas definições; o endereço deixa de o ter (atualizar a página não volta a abri-las).
  useEffect(() => {
    if (!openSettingsFirst) return
    const url = new URL(window.location.href)
    url.searchParams.delete('premios')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [openSettingsFirst])
  const [rulesOpen, setRulesOpen] = useState(false)
  const [selectedClipper, setSelectedClipper] = useState<ClipperRow | null>(null)
  const isActive = lb.status === 'active'
  const name = lb.name
  const liveStatus = isLive ?? (demo ? false : undefined)
  const currentPeriod = periods[0]
  // Ordenação e período são lidos do URL no cliente. Como todos os períodos vêm
  // carregados do servidor, trocar de separador é instantâneo (sem pedidos à rede).
  const searchParams = useSearchParams()
  const sort: 'views' | 'media' = searchParams.get('ordem') === 'media' ? 'media' : 'views'
  const urlPeriod = searchParams.get('periodo')
  const wantedPeriod = sort === 'media' ? currentPeriod : urlPeriod && periods.includes(urlPeriod) ? urlPeriod : currentPeriod
  const dataset = datasets?.[wantedPeriod]
  const periodKey = dataset ? wantedPeriod : serverPeriodKey
  const clippers = dataset?.clippers ?? serverClippers
  const totals = dataset?.totals ?? serverTotals
  const isHistory = periodKey === ALL_TIME && periods.length > 1
  const activeTab = sort === 'media' ? 'media' : isHistory ? 'history' : 'views'
  const [isPending, startTransition] = useTransition()
  const [shownTab, setShownTab] = useOptimistic(activeTab)
  // Desempate fixo (nome, depois id): com views iguais a ordem nunca muda sozinha entre atualizações.
  const tieBreak = (a: ClipperRow, b: ClipperRow) => a.displayName.localeCompare(b.displayName, 'pt') || a.participantId.localeCompare(b.participantId)
  const byViews = [...clippers].sort((a, b) => b.totalViews - a.totalViews || tieBreak(a, b))
  const officialPositions = new Map(byViews.map((row, i) => [row.participantId, i + 1]))
  const rows = sort === 'media' ? [...clippers].sort((a, b) => b.avgViews - a.avgViews || b.totalViews - a.totalViews || tieBreak(a, b)) : byViews
  const podium = byViews.slice(0, 3)
  const tableBody = useRankingFlip(`${periodKey}|${rows.map(row => row.participantId).join(',')}`)
  const rewardPool = rewards.filter(r => r.amount_cents != null).reduce((sum, r) => sum + (r.amount_cents ?? 0), 0)
  // Quantias ocultas chegam sem valor (amount_hidden): o total também fica por revelar.
  const hiddenPool = rewards.some(r => r.amount_hidden)
  const podiumHeadline = rewardPool > 0 || hiddenPool
    ? <><PrizeAmount blur={lb.blur_rewards || hiddenPool}>{money(rewardPool, rewards.find(r => r.amount_cents != null)?.currency ?? 'EUR')}</PrizeAmount> em prémios</>
    : `${compactNumber(podium.reduce((sum, row) => sum + row.totalViews, 0))} views no pódio`

  const href = (period: string, order: string) => {
    const params = new URLSearchParams()
    if (period !== currentPeriod) params.set('periodo', period)
    if (order !== 'views') params.set('ordem', order)
    return `/${lb.slug}${params.size ? `?${params}` : ''}`
  }

  /** Troca de separador com resposta imediata: só vai ao servidor se o período mudar. */
  const go = (period: string, order: 'views' | 'media', tab: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    const target = href(period, order)
    // "Maior média" é sempre calculada sobre o período atual (igual ao servidor).
    const targetPeriod = order === 'media' ? currentPeriod : period
    if (targetPeriod === periodKey || datasets?.[targetPeriod]) {
      window.history.pushState(null, '', target)
      return
    }
    startTransition(() => {
      setShownTab(tab)
      router.push(target, { scroll: false })
    })
  }

  const joinHref = `/api/auth/tiktok/start?lb=${encodeURIComponent(lb.slug)}`
  // Quem já participa (ou é o dono) não vê "Participar": vê as suas definições.
  const isClipper = !isOwner && clipperSettings != null
  const canJoin = isActive && !isOwner && !isClipper
  const prefetchClipper = (row: ClipperRow) => () => { loadClipperDetails(lb.slug, row.participantId, periodKey).catch(() => {}) }

  return <div className={styles.page} data-product-page>
    {!demo && <AutoRefresh seconds={60} />}

    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.identity}>
          <Link href={`/${lb.slug}`} aria-label={name} className="inline-flex shrink-0">
            <Portrait src={creator?.avatar_url ?? lb.cover_url} name={name} />
          </Link>
          <div>
            <Link href={`/${lb.slug}`}><strong>{name}</strong></Link>
            <span className={styles.identityPlatforms}>
              <svg role="img" aria-label="YouTube" className={styles.platformYoutube} viewBox="0 3.545 24 16.91">
                <path fill="#fc0034" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
                <path fill="#fff" d="M9.545 15.568V8.432L15.818 12z" />
              </svg>
              <span className={styles.streamStatus} data-live={liveStatus === true} title={demo ? 'Estado ilustrativo da demonstração' : undefined}>
                <i aria-hidden="true" />{liveStatus === undefined ? 'Estado indisponível' : liveStatus ? 'Em live' : 'Offline'}
              </span>
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          {canJoin && <a className={styles.primaryButton} href={joinHref}>Participar</a>}
          {(isOwner || isClipper) && <button type="button" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" aria-label="Definições" title="Definições" className={styles.settingsLink}>
            <Settings size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>}
        </div>
      </div>
    </header>

    <main className={styles.main}>
      <h1 className={styles.srOnly}>{lb.name} · {name}</h1>
      {isOwner && shownPrize ? <section className={summary.timerSection} aria-label="Entregar prémios">
        <PrizeDueBanner prize={shownPrize} leaderboardId={lb.id} returnTo={`/${lb.slug}`} />
      </section> : pause ? <section className={summary.timerSection} aria-label="Competição em pausa">
        <PrizeStatusBanner {...pause} />
      </section> : clockFor && <section className={summary.timerSection} aria-label="Fim da competição">
        <CompetitionClock target={clockFor} onEnd={isOwner ? endClock : undefined} />
      </section>}

      <section className={summary.stats} aria-label="Estatísticas da competição">
        {[{ label: 'Views da comunidade', shortLabel: 'Views', value: totals.total_views, compact: true, detail: periodLabel(periodKey), icon: Eye, tone: 'orange' },
          { label: 'Clips publicados', shortLabel: 'Clips', value: totals.total_clips, compact: false, detail: 'Momentos que ficaram', icon: Film, tone: 'blue' },
          { label: 'Clippers na corrida', shortLabel: 'Clippers', value: totals.active_clippers, compact: false, detail: 'Juntos pelo mesmo objetivo', icon: Users, tone: 'green' },
          { label: 'Likes nos clips', shortLabel: 'Likes', value: totals.total_likes, compact: true, detail: 'O apoio da comunidade', icon: Heart, tone: 'pink' }].map(stat => <div className={summary.stat} key={stat.label}>
            <div className={summary.statLabel}><span className={summary.statLabelFull}>{stat.label}</span><span className={summary.statLabelShort}>{stat.shortLabel}</span><span className={summary.statIcon}><stat.icon size={14} /></span></div>
            <strong><AnimatedNumber value={stat.value} compact={stat.compact} /></strong><span>{stat.detail}</span>
          </div>)}
      </section>

      <section className={ranking.section} id="ranking" aria-labelledby="ranking-title">
        <div className={ranking.panel}>
        <div className={ranking.header}>
        <h2 id="ranking-title" className={styles.srOnly}>Classificação dos Clippers</h2>
        <div className={ranking.tableToolbar}>
          <nav className={ranking.tabs} aria-label="Ordenação do ranking">
            <Link href={href(currentPeriod, 'views')} onClick={go(currentPeriod, 'views', 'views')} scroll={false} aria-current={shownTab === 'views' ? 'page' : undefined}>{periods.length > 1 ? 'Este mês' : 'Mais views'}</Link>
            <Link href={href(currentPeriod, 'media')} onClick={go(currentPeriod, 'media', 'media')} scroll={false} aria-current={shownTab === 'media' ? 'page' : undefined}>Maior média</Link>
            {periods.length > 1 && <Link href={href(ALL_TIME, 'views')} onClick={go(ALL_TIME, 'views', 'history')} scroll={false} aria-current={shownTab === 'history' ? 'page' : undefined}>De sempre</Link>}
          </nav>
        </div>
        </div>

        {podium.length > 0 && <div key={`podium-${periodKey}`} className={ranking.podiumRow} style={isPending ? { opacity: .55, transition: 'opacity 150ms' } : undefined} aria-label={isHistory ? 'Pódio de sempre' : 'Pódio do mês'}>
          <div className={ranking.podiumStage}>
            {[podium[1], podium[0], podium[2]].filter(Boolean).map(row => {
              const index = podium.indexOf(row)
              const reward = rewards.find(r => r.position === index + 1)
              const prizeText = reward?.amount_cents != null ? money(reward.amount_cents, reward.currency ?? 'EUR') : reward?.amount_hidden ? '' : reward?.label ?? null
              return <button type="button" onClick={() => setSelectedClipper(row)} onPointerEnter={prefetchClipper(row)} onFocus={prefetchClipper(row)} aria-label={`Ver perfil de ${row.displayName}`} aria-haspopup="dialog" key={row.participantId} className={`${ranking.podiumColumn} ${ranking[`podiumPlace${index + 1}`]}`}>
                <span className={ranking.podiumRing}>
                  
                  <Portrait src={row.avatarUrl} name={row.displayName} className={ranking.podiumPortrait} />
                </span>
                <strong>{row.displayName}</strong>
                <span className={ranking.podiumPill}><Gift size={10} /><PrizeAmount blur={reward?.amount_hidden || (lb.blur_rewards && reward?.amount_cents != null)}>{prizeText ?? compactNumber(row.totalViews)}</PrizeAmount></span>
                <span className={ranking.podiumBlock}>
                  <PodiumSurface place={index + 1} />
                  <Laurel className={ranking.podiumWreath} />
                  <span className={ranking.podiumNumber}>{index + 1}</span>
                </span>
              </button>
            })}
          </div>
          <div className={ranking.podiumHeadline}>
            <button className={ranking.howItWorks} onClick={() => setRulesOpen(true)}>Como funciona</button>
            <strong>{podiumHeadline}</strong>
            <span><Clock size={12} />{periodLabel(periodKey)}</span>
          </div>
        </div>}

        <div className={ranking.tableScroll} style={isPending ? { opacity: .55, transition: 'opacity 150ms' } : undefined} aria-busy={isPending} tabIndex={0} role="region" aria-label="Estatísticas dos clippers">
          <table className={ranking.table} data-sort={sort}>
            <thead><tr>
              <th scope="col">Rank</th><th scope="col">Clipper</th>
              <th scope="col" aria-sort={sort === 'views' ? 'descending' : 'none'}><Link href={href(periodKey, 'views')} onClick={go(periodKey, 'views', isHistory ? 'history' : 'views')} scroll={false}>{periodKey === ALL_TIME ? 'Views totais' : 'Views no mês'}</Link></th>
              <th scope="col" aria-sort={sort === 'media' ? 'descending' : 'none'}><Link href={href(currentPeriod, 'media')} onClick={go(currentPeriod, 'media', 'media')} scroll={false}>Média / TikTok</Link></th>
              <th scope="col">Likes</th><th scope="col">Seguidores</th><th scope="col">Clips</th><th scope="col">Prémios</th>
            </tr></thead>
            <tbody ref={tableBody}>{rows.map((row, i) => {
              const position = i + 1
              const officialPosition = officialPositions.get(row.participantId) ?? 0
              const reward = !isHistory ? rewards.find(r => r.position === officialPosition) : undefined
              const prize = reward?.amount_cents != null ? money(reward.amount_cents, reward.currency ?? 'EUR') : reward?.amount_hidden ? '' : reward?.label
              return <tr key={row.participantId} data-id={row.participantId} className={ranking.clipperRow} onClick={() => setSelectedClipper(row)} onPointerEnter={prefetchClipper(row)} onFocus={prefetchClipper(row)}>
                <td><span className={`${ranking.position} ${position <= 3 ? ranking[`rank${position}`] : ''}`}>{position <= 3 && <Laurel className={ranking.positionWreath} />}<span className={ranking.positionNumber}>{position}</span></span></td>
                <td><button type="button" className={ranking.clipperCell} aria-haspopup="dialog" title={`Ver perfil de ${row.displayName}`}><Portrait src={row.avatarUrl} name={row.displayName} /><strong>{row.displayName}</strong></button></td>
                <td className={ranking.viewsCell}>{compactNumber(row.totalViews)}</td>
                <td className={ranking.viewsCell}>{compactNumber(row.avgViews)}</td>
                <td className={ranking.viewsCell}>{compactNumber(row.totalLikes)}</td>
                <td className={ranking.viewsCell}>{row.followerCount == null ? '—' : compactNumber(row.followerCount)}</td>
                <td className={ranking.viewsCell}>{fullNumber(row.videoCount)}</td>
                <td className={ranking.prizeCell} title={reward?.amount_hidden || (lb.blur_rewards && reward?.amount_cents != null) ? undefined : prize ?? undefined}><PrizeAmount blur={reward?.amount_hidden || (lb.blur_rewards && reward?.amount_cents != null)}>{prize ?? '—'}</PrizeAmount></td>
              </tr>
            })}</tbody>
          </table>
        </div>
        {rows.length === 0 && <div className={styles.empty}><Users size={24} /><h3>A corrida começa contigo</h3><p>Ainda não há participantes nesta competição.</p>{canJoin && <a className={styles.primaryButton} href={joinHref}>Participar</a>}</div>}
        </div>
      </section>

      <LivesView demo={demo} initialLives={lives} timezone={lb.timezone} clips={clips} />

      <footer className={styles.siteFooter}>
        <p className={styles.siteFooterNote}>{demo ? 'Página de demonstração · ' : ''}<Link href="/">© {new Date().getFullYear()} farmerrr</Link></p>
      </footer>
    </main>

    {rulesOpen && <SettingsDrawer title="Como funciona" closeLabel="Fechar regras" onClose={() => setRulesOpen(false)}>
      <div className={styles.rulesContent} style={{ marginTop: 0 }}>
        <p>Conecta a tua conta de TikTok.</p>
        <p>Publica clips originais das streams de {name}.</p>
        <p>Mantém os vídeos públicos para entrarem na contagem.</p>
        <p>Os clips publicados durante o mês entram automaticamente no ranking.</p>
        <p>Views compradas, conteúdo duplicado ou vídeos fora do tema podem levar à desqualificação.</p>
        <p>No final do mês, consulta a classificação final e, caso tenhas direito a prémio, recebe-o de acordo com as condições definidas.</p>
      </div>
    </SettingsDrawer>}
    {selectedClipper && <ClipperDialog key={`${selectedClipper.participantId}-${periodKey}`} clipper={selectedClipper} slug={lb.slug} periodKey={periodKey} onClose={() => setSelectedClipper(null)} />}
    {/* Depois de "Terminar sessão" já não há definições: o painel fecha sozinho. */}
    {settingsOpen && (isOwner || isClipper) && <SettingsDrawer onClose={() => setSettingsOpen(false)}>{isOwner ? settingsContent : clipperSettings}</SettingsDrawer>}
  </div>
}
