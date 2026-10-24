'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/ui/brand-logo'
import { LivesView } from '@/components/lives/LivesView'
import type { Live } from '@/components/lives/scale'
import { ArrowUpRight, Clock, Eye, Film, Gift, Heart, ShieldCheck, Users, X } from 'lucide-react'
import type { Creator, Leaderboard, Reward } from '@/lib/db/types'
import type { ClipperRow, VideoRow } from '@/lib/db/board'
import { ALL_TIME, periodLabel } from '@/lib/period'
import { compactNumber, fullNumber, money } from '@/lib/format'
import { AutoRefresh } from './auto-refresh'
import { AnimatedNumber } from './animated-number'
import styles from './streamer-leaderboard.module.css'
import summary from './competition-summary.module.css'
import ranking from './ranking.module.css'
import { ClipperDialog } from './clipper-dialog'

type Props = {
  leaderboard: Leaderboard
  creator: Creator | null
  clippers: ClipperRow[]
  totals: { total_views: number; total_clips: number; active_clippers: number; total_likes: number; avg_views: number }
  rewards: Reward[]
  videos: VideoRow[]
  allVideos: VideoRow[]
  periods: string[]
  periodKey: string
  sort: 'views' | 'media'
  demo: boolean
  isLive?: boolean
  lives?: Live[]
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

function Laurel({ className }: { className?: string }) {
  return <svg viewBox="0 0 100 80" className={className} aria-hidden focusable="false">
    {[false, true].map(mirror => <g key={String(mirror)} transform={mirror ? 'translate(100 0) scale(-1 1)' : undefined}>
      <path d="M46 73 C13 65 9 35 27 10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {[{x:23,y:17,r:20},{x:17,y:28,r:0},{x:14,y:40,r:-20},{x:17,y:52,r:-42},{x:25,y:62,r:-62},{x:37,y:69,r:-80}].map(({x,y,r}, i) => <g key={i} transform={`translate(${x} ${y}) rotate(${r})`} fill="currentColor">
        <path d="M0 3 C-12 -1 -12 -10 -9 -14 C-2 -11 1 -5 0 3Z" />
        <path d="M1 4 C0 -4 4 -9 9 -10 C12 -3 8 2 1 4Z" opacity=".8" />
      </g>)}
      <path d="M38 76 Q46 69 53 72" fill="none" stroke="currentColor" strokeWidth="2" />
    </g>)}
  </svg>
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

function EventClock({ target }: { target: string }) {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(target).getTime() - Date.now()))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [target])
  const seconds = Math.floor((remaining ?? 0) / 1000)
  const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60]
  return <div className={summary.countdown}>
    {remaining === 0 ? <p className={summary.eventEnded}>Data da live atingida</p> : <div className={summary.clock}>
      {['dias', 'horas', 'min', 'seg'].map((unit, i) => <div key={unit} className={summary.clockUnit}>
        {i > 0 && <span className={summary.clockSeparator} aria-hidden>:</span>}
        <strong>{remaining === null ? '--' : String(values[i]).padStart(2, '0')}</strong><span>{unit}</span>
      </div>)}
    </div>}
  </div>
}

export function StreamerLeaderboard({ leaderboard: lb, creator, clippers, totals, rewards, periods, periodKey, sort, demo, isLive, lives = [] }: Props) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const rulesDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (rulesOpen) rulesDialog.current?.showModal() }, [rulesOpen])
  const [selectedClipper, setSelectedClipper] = useState<ClipperRow | null>(null)
  const isActive = lb.status === 'active'
  const name = creator?.name ?? lb.name
  const liveStatus = isLive ?? (demo ? false : undefined)
  const currentPeriod = periods[0]
  const isHistory = periodKey === ALL_TIME && periods.length > 1
  const rows = [...clippers].sort((a, b) => sort === 'media' ? b.avgViews - a.avgViews || b.totalViews - a.totalViews : b.totalViews - a.totalViews)
  const podium = [...clippers].sort((a, b) => b.totalViews - a.totalViews).slice(0, 3)
  const rewardPool = rewards.filter(r => r.amount_cents != null).reduce((sum, r) => sum + (r.amount_cents ?? 0), 0)
  const podiumHeadline = rewardPool > 0 ? `${money(rewardPool, rewards.find(r => r.amount_cents != null)?.currency ?? 'EUR')} em prémios` : `${compactNumber(podium.reduce((sum, row) => sum + row.totalViews, 0))} views no pódio`

  const href = (period: string, order: string) => {
    const params = new URLSearchParams()
    if (period !== currentPeriod) params.set('periodo', period)
    if (order !== 'views') params.set('ordem', order)
    return `/${lb.slug}${params.size ? `?${params}` : ''}`
  }

  return <div className={styles.page} data-product-page>
    {!demo && <AutoRefresh seconds={60} />}

    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href={`/${lb.slug}`} className={styles.identity}>
          <Portrait src={creator?.avatar_url ?? lb.cover_url} name={name} />
          <div>
            <strong>{name}</strong>
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
        </Link>
        <div className={styles.headerActions}>
          {isActive && <Link className={styles.primaryButton} href={`/join/${lb.slug}`}>Participar</Link>}
        </div>
      </div>
    </header>

    <main className={styles.main}>
      <h1 className={styles.srOnly}>{lb.name} · {name}</h1>
      {lb.event_at && <section className={summary.timerSection} aria-label="Próxima live">
        <EventClock target={lb.event_at} />
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
            <Link href={href(currentPeriod, 'views')} scroll={false} aria-current={!isHistory && sort === 'views' ? 'page' : undefined}>{periods.length > 1 ? 'Este mês' : 'Mais views'}</Link>
            <Link href={href(currentPeriod, 'media')} scroll={false} aria-current={sort === 'media' ? 'page' : undefined}>Maior média</Link>
            {periods.length > 1 && <Link href={href(ALL_TIME, 'views')} scroll={false} aria-current={isHistory && sort === 'views' ? 'page' : undefined}>De sempre</Link>}
          </nav>
        </div>
        </div>

        {podium.length > 0 && <div key={`podium-${periodKey}-${sort}`} className={`${ranking.podiumRow} ${ranking.rankingTransition}`} aria-label={isHistory ? 'Pódio de sempre' : 'Pódio do mês'}>
          <div className={ranking.podiumStage}>
            {[podium[1], podium[0], podium[2]].filter(Boolean).map(row => {
              const index = podium.indexOf(row)
              const reward = rewards.find(r => r.position === index + 1)
              const prizeText = reward?.amount_cents != null ? money(reward.amount_cents, reward.currency ?? 'EUR') : reward?.label ?? null
              return <button type="button" onClick={() => setSelectedClipper(row)} aria-label={`Ver perfil de ${row.displayName}`} aria-haspopup="dialog" key={row.participantId} className={`${ranking.podiumColumn} ${ranking[`podiumPlace${index + 1}`]}`}>
                <span className={ranking.podiumRing}>
                  
                  <Portrait src={row.avatarUrl} name={row.displayName} className={ranking.podiumPortrait} />
                </span>
                <strong>{row.displayName}</strong>
                <span className={ranking.podiumPill}><Gift size={10} />{prizeText ?? compactNumber(row.totalViews)}</span>
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

        <div key={`table-${periodKey}-${sort}`} className={`${ranking.tableScroll} ${ranking.rankingTransition}`} tabIndex={0} role="region" aria-label="Estatísticas dos clippers">
          <table className={ranking.table} data-sort={sort}>
            <thead><tr>
              <th scope="col">Rank</th><th scope="col">Clipper</th>
              <th scope="col" aria-sort={sort === 'views' ? 'descending' : 'none'}><Link href={href(periodKey, 'views')} scroll={false}>{periodKey === ALL_TIME ? 'Views totais' : 'Views no mês'}</Link></th>
              <th scope="col" aria-sort={sort === 'media' ? 'descending' : 'none'}><Link href={href(currentPeriod, 'media')} scroll={false}>Média / TikTok</Link></th>
              <th scope="col">Likes</th><th scope="col">Seguidores</th><th scope="col">Clips</th><th scope="col">Prémios</th>
            </tr></thead>
            <tbody>{rows.map(row => {
              const position = rows.indexOf(row) + 1
              const officialPosition = [...clippers].sort((a, b) => b.totalViews - a.totalViews).findIndex(c => c.participantId === row.participantId) + 1
              const reward = !isHistory ? rewards.find(r => r.position === officialPosition) : undefined
              const prize = reward?.amount_cents != null ? money(reward.amount_cents, reward.currency ?? 'EUR') : reward?.label
              return <tr key={row.participantId} className={ranking.clipperRow} onClick={() => setSelectedClipper(row)}>
                <td><span className={`${ranking.position} ${position <= 3 ? ranking[`rank${position}`] : ''}`}>{position <= 3 && <Laurel className={ranking.positionWreath} />}<span className={ranking.positionNumber}>{position}</span></span></td>
                <td><button type="button" className={ranking.clipperCell} aria-haspopup="dialog" title={`Ver perfil de ${row.displayName}`}><Portrait src={row.avatarUrl} name={row.displayName} /><strong>{row.displayName}</strong></button></td>
                <td className={ranking.viewsCell}>{compactNumber(row.totalViews)}</td>
                <td className={ranking.viewsCell}>{compactNumber(row.avgViews)}</td>
                <td className={ranking.viewsCell}>{compactNumber(row.totalLikes)}</td>
                <td className={ranking.viewsCell}>{row.followerCount == null ? '—' : compactNumber(row.followerCount)}</td>
                <td className={ranking.viewsCell}>{fullNumber(row.videoCount)}</td>
                <td className={ranking.prizeCell} title={prize ?? undefined}>{prize ?? '—'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
        {rows.length === 0 && <div className={styles.empty}><Users size={24} /><h3>A corrida começa contigo</h3><p>Ainda não há participantes nesta competição.</p>{isActive && <Link className={styles.primaryButton} href={`/join/${lb.slug}`}>Participar</Link>}</div>}
        </div>
      </section>

      <LivesView demo={demo} initialLives={lives} timezone={lb.timezone} />

      <footer className={styles.footer}><Link href="/"><BrandLogo /></Link><span>A comunidade cria. Os números contam.</span><div>{demo ? <span>Demonstração</span> : <span><ShieldCheck size={13} /> Ranking da comunidade</span>}<Link href="/legal/privacidade">Privacidade <ArrowUpRight size={12} /></Link></div></footer>
    </main>

    <dialog ref={rulesDialog} className={`${styles.dialog} ${styles.rulesDialog}`} aria-labelledby="rules-title" onClose={() => setRulesOpen(false)} onClick={e => { if (e.target === e.currentTarget) rulesDialog.current?.close() }}>
      <div className={styles.dialogHeader}><h2 id="rules-title">Como funciona</h2><button className={styles.iconButton} onClick={() => rulesDialog.current?.close()} aria-label="Fechar regras"><X size={18} /></button></div>
      <div className={styles.rulesContent}>
        <p>Conecta a tua conta de TikTok.</p>
        <p>Publica clips originais das streams de Luís Ferreira.</p>
        <p>Mantém os vídeos públicos para entrarem na contagem.</p>
        <p>Os clips publicados durante o mês entram automaticamente no ranking.</p>
        <p>Views compradas, conteúdo duplicado ou vídeos fora do tema podem levar à desqualificação.</p>
        <p>No final do mês, consulta a classificação final e, caso tenhas direito a prémio, recebe-o de acordo com as condições definidas.</p>
      </div>
    </dialog>
    {selectedClipper && <ClipperDialog key={`${selectedClipper.participantId}-${periodKey}`} clipper={selectedClipper} slug={lb.slug} periodKey={periodKey} onClose={() => setSelectedClipper(null)} />}
  </div>
}
