'use client'

import { useEffect, useRef, useState } from 'react'
import localFont from 'next/font/local'
import { LockKeyhole, Maximize2, Minimize2, Play, RotateCw, X } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { DEMO_SLUG } from '@/lib/leaderboards/demo'

const annotationFont = localFont({
  src: '../../../public/fonts/fuzzy-bubbles/FuzzyBubbles-Regular.ttf',
  weight: '400',
  style: 'normal',
  display: 'swap',
})

export function InteractiveDemo() {
  const href = `/${DEMO_SLUG}`
  const [showRecap, setShowRecap] = useState(false)
  const activeHref = showRecap ? '/demos/recap.html' : href
  const frame = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLIFrameElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [fallbackExpanded, setFallbackExpanded] = useState(false)

  useEffect(() => {
    const update = () => setExpanded(document.fullscreenElement === frame.current || fallbackExpanded)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [fallbackExpanded])

  useEffect(() => {
    if (!fallbackExpanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setFallbackExpanded(false); setExpanded(false) }
    }
    document.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close) }
  }, [fallbackExpanded])

  const toggleFullscreen = async () => {
    if (fallbackExpanded) { setFallbackExpanded(false); setExpanded(false); return }
    try {
      if (document.fullscreenElement === frame.current) {
        await document.exitFullscreen()
      } else if (frame.current?.requestFullscreen) {
        await frame.current.requestFullscreen()
      } else {
        setFallbackExpanded(true); setExpanded(true)
      }
    } catch {
      setFallbackExpanded(true); setExpanded(true)
    }
  }

  return (
    <section id="como-funciona" className="scroll-mt-20 pb-16 sm:pb-20">
      <Container>
        <div className="mb-4 flex items-center justify-end gap-2 pr-4">
          <svg
            aria-hidden
            viewBox="0 0 219 41"
            className="mt-2 w-8 shrink-0 -rotate-[24deg] fill-current text-fg-muted opacity-60"
          >
            <path d="M21.489 29.4305C36.9333 31.3498 51.3198 33.0559 65.7063 34.9753C66.7641 35.1885 67.6104 36.4681 69.9376 38.3875C63.1675 39.2406 57.8783 40.3069 52.5892 40.5201C38.6259 40.9467 24.8741 40.9467 10.9107 40.9467C9.21821 40.9467 7.5257 41.1599 5.83317 40.7334C0.332466 39.6671 -1.57164 36.0416 1.39028 31.1365C2.87124 28.7906 4.56377 26.658 6.46786 24.7386C13.6611 17.4876 21.0659 10.4499 28.4707 3.41224C29.7401 2.13265 31.6442 1.49285 34.183 0C34.6061 10.8765 23.8162 13.8622 21.489 22.3927C23.3931 21.9662 25.0856 21.7529 26.5666 21.3264C83.6894 5.54486 140.601 7.25099 197.3 22.606C203.224 24.0988 208.936 26.4447 214.649 28.5773C217.61 29.6437 220.149 31.9896 218.457 35.6151C216.976 39.2406 214.014 39.2406 210.629 37.7477C172.759 20.6866 132.561 18.7672 91.9404 19.407C70.7838 19.6203 50.0504 21.9662 29.5285 26.8713C26.9897 27.5111 24.4509 28.3641 21.489 29.4305Z" />
          </svg>
          <span className={`${annotationFont.className} text-sm text-fg-muted`}>
            aqui um exemplo
          </span>
        </div>

        <div ref={frame} className={`overflow-hidden border border-line ${fallbackExpanded ? 'fixed inset-0 z-[100]' : ''} ${expanded ? 'flex h-dvh w-screen flex-col bg-canvas' : 'relative rounded-xl bg-surface/50'}`}>
          <div className="hidden shrink-0 grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-3 border-b border-line/70 bg-surface-2/60 px-4 py-2.5 sm:grid">
            <span aria-hidden className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="nums min-w-0 max-w-full justify-self-center truncate py-1 text-center text-[11px] text-fg-subtle hover:text-fg"
            >
              farmerrr.pt{activeHref}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={expanded ? 'Sair do ecrã inteiro' : 'Ampliar demo'}
              title={expanded ? 'Sair do ecrã inteiro' : 'Ampliar demo'}
              className="grid h-7 w-7 shrink-0 place-items-center justify-self-end rounded-xs text-fg-muted hover:bg-surface-3 hover:text-fg"
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

          <div className={`relative ${expanded ? 'min-h-0 flex-1' : ''}`}>
          <iframe
            key={activeHref}
            ref={preview}
            src={activeHref}
            title={showRecap ? 'Recap de setembro' : 'Demo do ranking de clippers de Luís Ferreira'}
            loading="lazy"
            className={`block w-full border-0 bg-canvas ${expanded ? 'h-full' : 'h-[430px] sm:h-[850px]'}`}
          />
          <button
            type="button"
            onClick={() => setShowRecap(value => !value)}
            aria-label={showRecap ? 'Voltar ao ranking' : 'Ver o recap'}
            title={showRecap ? 'Voltar ao ranking' : 'Ver o recap'}
            aria-pressed={showRecap}
            className={`absolute z-10 grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-white/10 bg-[#292929] text-white shadow-lg transition-colors hover:bg-[#3a3a3a] ${showRecap ? 'top-3 left-3' : 'bottom-4 right-4'}`}
          >
            {showRecap ? <X size={19} aria-hidden="true" /> : <Play size={18} strokeWidth={1.6} aria-hidden="true" />}
          </button>
          </div>
          <div className="shrink-0 border-t border-white/10 bg-[#1c1c1e] px-3 pt-2.5 pb-2 sm:hidden">
            <div className="flex h-10 items-center rounded-xl bg-[#303033] px-3 text-[#f5f5f7] shadow-sm">
              <span aria-hidden="true" className="w-7 text-[15px] tracking-tight">aA</span>
              <button type="button" onClick={toggleFullscreen} aria-label={expanded ? 'Sair do ecrã inteiro' : 'Ampliar demo'} className="flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 text-[12px]">
                <LockKeyhole size={11} className="shrink-0 text-[#aeaeb2]" />
                <span className="truncate">farmerrr.pt{activeHref}</span>
              </button>
              <button type="button" onClick={() => { if (preview.current) preview.current.src = activeHref }} aria-label="Recarregar exemplo" className="grid h-10 w-7 shrink-0 place-items-center">
                <RotateCw size={16} strokeWidth={1.8} />
              </button>
            </div>
            <div aria-hidden="true" className="mx-auto mt-3 h-1 w-24 rounded-full bg-white/70" />
          </div>
        </div>
        <div className={`${annotationFont.className} relative mt-3 mr-12 ml-auto w-fit text-center text-sm leading-relaxed text-fg-muted`}>
          <svg aria-hidden="true" viewBox="0 0 40 48" fill="none" className="absolute -top-6 -right-9 h-10 w-8 -scale-x-100 text-fg-muted">
            <path d="M32 42C8 40 5 20 24 7M13 8l13-4-1 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-fg">Experimenta ✨</span>
          <span className="block text-xs">(recap mensal)</span>
        </div>
      </Container>
    </section>
  )
}
