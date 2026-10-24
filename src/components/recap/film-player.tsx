'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Player, type PlayerRef } from '@remotion/player'
import { RecapFilm, FILM_SECONDS, chapters, type FilmData } from './film'

export function FilmPlayer({ data, slug, demo }: { data: FilmData; slug: string; demo: boolean }) {
  const player = useRef<PlayerRef>(null)
  const [portrait, setPortrait] = useState(false)
  const [started, setStarted] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const query = matchMedia('(max-aspect-ratio: 1/1)')
    const update = () => setPortrait(query.matches)
    update(); setReady(true)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return <main style={{ position: 'fixed', inset: 0, background: '#151714', color: '#f1efdf', zIndex: 80, display: 'flex', flexDirection: 'column' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', fontSize: 12, gap: 12 }}>
      <span>PRIMEIRO CORTE · 01:30 {demo ? '· DADOS DEMO' : ''}</span>
      <Link href={`/${slug}/recap`}>Fechar ✕</Link>
    </header>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'grid', placeItems: 'center' }}>
      {ready && <Player ref={player} component={RecapFilm} inputProps={{ data }} durationInFrames={FILM_SECONDS * 30} fps={30} compositionWidth={portrait ? 1080 : 1920} compositionHeight={portrait ? 1920 : 1080} controls clickToPlay doubleClickToFullscreen spaceKeyToPlayOrPause showVolumeControls style={{ width: '100%', height: '100%' }} />}
      {!started && <button onClick={() => { setStarted(true); player.current?.play() }} aria-label="Ver filme com som" style={{ position: 'absolute', inset: 0, border: 0, color: '#f1efdf', background: '#151714b8', backdropFilter: 'blur(8px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 25 }}>
        <span style={{ fontSize: 12, letterSpacing: 5 }}>UMA HISTÓRIA QUE FICA</span>
        <strong style={{ fontSize: 'clamp(40px, 6vw, 90px)', lineHeight: .95, letterSpacing: '-.06em' }}>Não foi só<br />mais uma live.</strong>
        <span style={{ background: '#ff6234', color: '#151714', borderRadius: 100, padding: '16px 28px', fontSize: 15, fontWeight: 800 }}>▶ Ver filme · 1 min 30 s</span>
        <span style={{ opacity: .7, fontSize: 12 }}>Com som. Feito para ver em ecrã inteiro.</span>
      </button>}
    </div>
    <nav aria-label="Capítulos do filme" style={{ display: 'flex', justifyContent: 'center', gap: 7, padding: '10px 12px', flexWrap: 'wrap' }}>
      {['O instante', 'Quem guardou', 'O alcance', 'O momento', 'A comunidade', 'O topo', 'O que fica'].map((name, i) => <button key={name} onClick={() => { setStarted(true); player.current?.seekTo(chapters[i] * 30); player.current?.play() }} style={{ border: '1px solid #ffffff25', padding: '5px 10px', borderRadius: 30, fontSize: 11, cursor: 'pointer' }}>{name}</button>)}
    </nav>
  </main>
}

