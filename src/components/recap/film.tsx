import React from 'react'
import { AbsoluteFill, Audio, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

export const FILM_SECONDS = 90
export type FilmData = { edition: string; community: string; clips: number; views: number; people: number; shares: number; bestViews: number; bestName: string; bestImage: string | null; winner: string; images: string[] }
export const demoFilm: FilmData = { edition: 'AGOSTO 2026', community: 'LUISFERREIRA', clips: 248, views: 2847190, people: 18, shares: 32840, bestViews: 482190, bestName: 'Um momento. Mil reações.', bestImage: '/leaderboard/clip-1.jpg', winner: 'A comunidade', images: Array.from({ length: 6 }, (_, i) => `/leaderboard/clip-${i + 1}.jpg`) }
export const chapters = [0, 12, 25, 40, 58, 73, 83]
const orange = '#ff6234', cream = '#f1efdf', ink = '#151714'
const clamp = (v: number) => Math.max(0, Math.min(1, v))
const count = (n: number) => Math.round(n).toLocaleString('pt-PT')
const asset = (src: string) => src.startsWith('/') ? staticFile(src.slice(1)) : src

function Shot({ image, style, label = 'GUARDADO.' }: { image?: string | null; style?: React.CSSProperties; label?: string }) {
  return <div style={{ background: ink, border: '3px solid currentColor', borderRadius: 12, overflow: 'hidden', boxShadow: '0 22px 70px #0003', ...style }}>
    <div style={{ height: '85%', position: 'relative', overflow: 'hidden', background: '#343a30' }}>
      {image && <Img src={asset(image)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.5) contrast(1.1)' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent, #0007)' }} />
      <div style={{ position: 'absolute', left: 16, top: 16, padding: '6px 10px', background: orange, color: ink, fontSize: 15, fontWeight: 800 }}>● REC</div>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: cream, fontSize: 55 }}>▶</div>
    </div>
    <div style={{ height: '15%', color: cream, display: 'flex', alignItems: 'center', padding: '0 16px', fontWeight: 800, fontSize: 16, letterSpacing: 3 }}>{label}</div>
  </div>
}

export function RecapFilm({ data = demoFilm, sound = true }: { data?: FilmData; sound?: boolean }) {
  const frame = useCurrentFrame(), { width, height, fps } = useVideoConfig()
  const t = frame / fps, portrait = height > width
  const scale = width / (portrait ? 600 : 1600)
  const w = width / scale, h = height / scale
  const chapter = t < 12 ? 0 : t < 25 ? 1 : t < 40 ? 2 : t < 58 ? 3 : t < 73 ? 4 : t < 83 ? 5 : 6
  const start = chapters[chapter], local = t - start
  const dark = chapter === 0 || chapter === 3 || chapter === 5
  const bg = dark ? ink : chapter === 2 || chapter === 6 ? orange : cream
  const fg = dark ? cream : ink
  const enter = spring({ frame: Math.max(0, frame - start * fps), fps, config: { damping: 22, stiffness: 85 } })
  const inText = (delay: number) => ({ opacity: clamp((local - delay) * 2), transform: `translateY(${(1 - clamp((local - delay) * 1.5)) * 40}px)` })
  const title: React.CSSProperties = { fontSize: portrait ? 82 : 136, lineHeight: .91, letterSpacing: '-.075em', fontWeight: 900, margin: 0 }
  const kicker: React.CSSProperties = { fontSize: portrait ? 15 : 18, letterSpacing: 4, fontWeight: 700, marginBottom: 26 }
  const center: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: portrait ? 34 : 100 }
  const images = data.images.length ? data.images : [data.bestImage]
  return <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
    {sound && <Audio src={staticFile('recap/first-cut.wav')} volume={.65} />}
    <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', color: fg, fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* A persistent orbit and the same saved frame connect the entire story. */}
      <div style={{ position: 'absolute', width: w * 1.15, height: w * 1.15, borderRadius: '50%', border: `1px solid ${fg}25`, left: -w * .075, top: (h - w * 1.15) / 2, transform: `rotate(${t * 3}deg)` }}>
        {[0, 90, 180, 270].map(a => <div key={a} style={{ position: 'absolute', inset: 40, borderRadius: '50%', border: `1px dashed ${fg}20`, transform: `rotate(${a}deg) scale(${1 - a / 650})` }} />)}
      </div>
      <div style={{ position: 'absolute', top: 30, left: 34, fontSize: 19, fontWeight: 800, letterSpacing: -1 }}>farme<span style={{ background: fg, color: bg, padding: '2px 5px', borderRadius: 3 }}>rrr.</span></div>
      <div style={{ position: 'absolute', right: 34, top: 34, fontSize: 12, letterSpacing: 2 }}>{data.edition}</div>

      {chapter === 0 && <>
        <Shot image={data.bestImage} label="00:00:01 / UM INSTANTE" style={{ position: 'absolute', width: portrait ? 290 : 390, height: portrait ? 360 : 480, left: (w - (portrait ? 290 : 390)) / 2, top: h * .24, opacity: 1 - clamp((local - 4.5) / 1.8), transform: `rotate(${-8 + local}deg) scale(${1 + local * .025})` }} />
        <div style={{ ...center, opacity: clamp((local - 4.5) / .8) }}>
          <div style={kicker}>TUDO COMEÇA COM UM INSTANTE.</div>
          <h1 style={title}>Uma live<br />passa.</h1>
          <div style={{ ...title, color: orange, fontSize: portrait ? 73 : 124, marginTop: 16, ...inText(7.2) }}>Um momento<br />fica.</div>
        </div>
        <div style={{ position: 'absolute', bottom: 95, width: '100%', textAlign: 'center', fontSize: 16, letterSpacing: 3, opacity: 1 - clamp(local - 4) }}>ESTA HISTÓRIA É VOSSA.</div>
      </>}

      {chapter === 1 && <>
        {Array.from({ length: 8 }, (_, i) => <Shot key={i} image={images[i % images.length]} style={{ position: 'absolute', width: portrait ? 140 : 230, height: portrait ? 178 : 285, left: w / 2 + Math.cos(i * Math.PI / 4 + local * .035) * w * .46 - (portrait ? 70 : 115), top: h / 2 + Math.sin(i * Math.PI / 4 + local * .035) * h * .39 - (portrait ? 89 : 142), transform: `rotate(${i * 9 - 25}deg) scale(${enter})`, opacity: .8 }} />)}
        <div style={center}>
          <div style={{ background: cream, padding: portrait ? 24 : 38 }}>
            <div style={kicker}>ALGUÉM CARREGOU EM «CLIPAR».</div>
            {local < 5 ? <h1 style={title}>E vocês<br />estavam lá.</h1> : <><h1 style={{ ...title, fontSize: portrait ? 145 : 205 }}>{count(data.clips * clamp((local - 5) / 2))}</h1><div style={{ fontSize: portrait ? 40 : 56, fontWeight: 800, letterSpacing: -2 }}>momentos guardados.</div></>}
            <div style={{ fontSize: 21, marginTop: 25, ...inText(9) }}>Por {data.people} pessoas que viram algo mais.</div>
          </div>
        </div>
      </>}

      {chapter === 2 && <>
        {Array.from({ length: 18 }, (_, i) => <div key={i} style={{ position: 'absolute', width: 150 + i * 90, height: 150 + i * 90, border: `2px solid ${ink}30`, borderRadius: '50%', left: w / 2, top: h / 2, transform: `translate(-50%,-50%) scale(${.7 + (local % 3) * .12})` }} />)}
        <div style={center}>
          <div style={kicker}>MAS A HISTÓRIA NÃO ACABOU NA LIVE.</div>
          {local < 5 ? <h1 style={title}>O momento<br />saiu daqui.</h1> : <>
            <h1 style={{ ...title, fontSize: portrait ? 91 : 200 }}>{count(data.views * clamp((local - 5) / 3))}</h1>
            <div style={{ fontSize: portrait ? 50 : 90, fontWeight: 900, letterSpacing: -4 }}>visualizações.</div>
            <p style={{ fontSize: portrait ? 25 : 32, marginTop: 40, ...inText(9) }}>Um instante na live.<br />Uma história a circular.</p>
          </>}
        </div>
      </>}

      {chapter === 3 && <>
        <div style={{ position: 'absolute', inset: 0, opacity: .11 }}>{data.bestImage && <Img src={asset(data.bestImage)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(30px)', transform: `scale(${1.1 + local * .006})` }} />}</div>
        <div style={{ position: 'absolute', left: portrait ? 38 : 100, top: portrait ? h * .14 : h * .27, width: portrait ? w - 76 : w * .49, zIndex: 2 }}>
          <div style={{ ...kicker, color: orange }}>UM DELES FOI MAIS LONGE.</div>
          <h1 style={{ ...title, fontSize: portrait ? 73 : 106 }}>{local < 7 ? <>Lembram-se<br />deste?</> : <>Foi este<br />o momento.</>}</h1>
          <div style={{ ...inText(7), marginTop: 32 }}><strong style={{ fontSize: portrait ? 62 : 100, letterSpacing: -5 }}>{count(data.bestViews * clamp((local - 7) / 2))}</strong><div style={{ fontSize: 20, letterSpacing: 3 }}>VISUALIZAÇÕES NUM SÓ CLIP</div></div>
          <p style={{ maxWidth: 500, fontSize: 19, lineHeight: 1.4, ...inText(12) }}>{data.bestName}</p>
        </div>
        <Shot image={data.bestImage} label="O MOMENTO / MAIS VISTO" style={{ position: 'absolute', width: portrait ? 285 : 390, height: portrait ? 352 : 490, left: portrait ? (w - 285) / 2 : w * .64, top: portrait ? h * .56 : h * .2, transform: `rotate(${6 - local * .25}deg) scale(${.9 + enter * .1})`, borderColor: orange }} />
      </>}

      {chapter === 4 && <>
        <div style={{ ...center, justifyContent: 'flex-start', paddingTop: portrait ? h * .16 : h * .15 }}>
          <div style={kicker}>E NINGUÉM FEZ ISTO SOZINHO.</div>
          <h1 style={{ ...title, fontSize: portrait ? 70 : 115 }}>{local < 6 ? <>Um clip é um momento.<br />Juntos, são movimento.</> : <>A comunidade<br />levou-o mais longe.</>}</h1>
          <div style={{ marginTop: 35, ...inText(6) }}><strong style={{ fontSize: portrait ? 100 : 150, letterSpacing: -7 }}>{count(data.shares * clamp((local - 6) / 2))}</strong><div style={{ fontSize: 22, letterSpacing: 4 }}>PARTILHAS</div></div>
        </div>
        {Array.from({ length: 9 }, (_, i) => <Shot key={i} image={images[i % images.length]} label="PARTE DESTA HISTÓRIA" style={{ position: 'absolute', width: portrait ? 155 : 220, height: portrait ? 195 : 275, left: w / 2 + (i - 4) * (portrait ? 115 : 170) - (portrait ? 77 : 110), top: h * .72 + Math.abs(i - 4) * 12, transform: `rotate(${(i - 4) * 6}deg) translateY(${Math.sin(local + i) * 12}px)` }} />)}
      </>}

      {chapter === 5 && <div style={center}>
        <div style={{ width: 110, height: 110, background: orange, color: ink, display: 'grid', placeItems: 'center', fontSize: 70, fontWeight: 900, transform: `rotate(${45 + local * 4}deg)`, marginBottom: 45 }}><span style={{ transform: `rotate(${-45 - local * 4}deg)` }}>1</span></div>
        <div style={kicker}>NO TOPO DO RANKING DE VIEWS</div>
        <h1 style={{ ...title, fontSize: portrait ? 68 : 125, maxWidth: '100%', overflowWrap: 'anywhere', color: orange }}>{data.winner}</h1>
        <p style={{ fontSize: portrait ? 26 : 36, lineHeight: 1.3, maxWidth: 760, ...inText(3) }}>O primeiro lugar tem um nome.<br />Esta história tem {data.people}.</p>
      </div>}

      {chapter === 6 && <div style={center}>
        <div style={kicker}>{data.community} / {data.edition}</div>
        <h1 style={{ ...title, fontSize: portrait ? 79 : 130 }}>A live acabou.<br />A história<br /><span style={{ color: cream }}>ficou.</span></h1>
        <div style={{ display: 'flex', gap: portrait ? 24 : 75, marginTop: 45, borderTop: `1px solid ${ink}55`, paddingTop: 25 }}>
          {[['CLIPS', count(data.clips)], ['VIEWS', count(data.views)], ['PESSOAS', count(data.people)]].map(([label, value]) => <div key={label}><strong style={{ fontSize: portrait ? 28 : 44, letterSpacing: -1 }}>{value}</strong><div style={{ fontSize: 12, letterSpacing: 2, marginTop: 8 }}>{label}</div></div>)}
        </div>
        <div style={{ fontSize: 16, letterSpacing: 3, marginTop: 42 }}>ATÉ AO PRÓXIMO MOMENTO.</div>
      </div>}
      <div style={{ position: 'absolute', bottom: 27, left: 34, fontSize: 11, letterSpacing: 3 }}>{String(chapter + 1).padStart(2, '0')} — UMA HISTÓRIA QUE FICA</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 4, background: fg, width: `${t / FILM_SECONDS * 100}%`, opacity: .6 }} />
      {/* A fast physical wipe rather than a disconnected slideshow dissolve. */}
      {chapter > 0 && local < .6 && <div style={{ position: 'absolute', inset: 0, background: chapter % 2 ? orange : ink, transform: `translateX(${interpolate(local, [0, .6], [0, 105])}%)` }} />}
    </div>
  </AbsoluteFill>
}
