'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

const sections: Record<string, string> = {
  '/precos': 'precos', '/ajuda': 'faq',
  '/#leaderboard': 'como-funciona', '/#streamers': 'comunidade',
  '/#clippers': 'como-funciona', '/#integracoes': 'ecossistema',
  '/#feedback': 'comunidade',
}

export function PageNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [popup, setPopup] = useState<{ href: string; title: string } | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!popup) return
    dialog.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [popup])

  const navigate = (event: MouseEvent<HTMLDivElement>) => {
    if (pathname !== '/' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest('a')
    if (!link || link.hasAttribute('download')) return
    const url = new URL(link.href, window.location.href)
    if (url.origin !== window.location.origin) return
    const sectionId = sections[url.pathname + url.hash] ?? sections[url.pathname] ?? (url.pathname === '/' ? url.hash.slice(1) : undefined)
    const destination = sectionId ? document.getElementById(sectionId) : null
    event.preventDefault()
    event.stopPropagation()
    if (destination || (url.pathname === '/' && !url.hash)) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
      if (destination) destination.scrollIntoView({ behavior, block: 'start' })
      else window.scrollTo({ top: 0, behavior })
      return
    }
    setPopup({ href: url.pathname + url.search + url.hash, title: link.textContent?.trim() || 'Detalhes' })
  }

  return <div onClickCapture={navigate}>
    {children}
    <dialog ref={dialog} aria-label={popup?.title} onClose={() => setPopup(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }} className="fixed inset-0 m-auto h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-2xl border border-line bg-canvas p-0 text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      {popup && <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <span className="text-sm font-medium">{popup.title}</span>
          <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Fechar" className="cursor-pointer rounded-md p-2 text-fg-muted hover:bg-surface hover:text-fg"><X size={18} /></button>
        </div>
        <iframe src={popup.href} title={popup.title} className="min-h-0 w-full flex-1 border-0" />
      </div>}
    </dialog>
  </div>
}
