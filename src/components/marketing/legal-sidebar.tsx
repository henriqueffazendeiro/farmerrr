'use client'

import { useEffect, useRef, useState } from 'react'
import { LEGAL_ICONS, type LegalIcon } from './legal-icons'

export type SidebarGroup = { title: string; icon: LegalIcon; items: { id: string; title: string }[] }

/** Índice das páginas legais (estilo documentação): marca a secção visível ao fazer scroll na página. */
export function LegalSidebar({ groups }: { groups: SidebarGroup[] }) {
  const [active, setActive] = useState(groups[0]?.items[0]?.id)
  const nav = useRef<HTMLDivElement>(null)
  // Depois de um clique no índice, o scroll suave passa por outras secções: não as marcar.
  const lockedUntil = useRef(0)

  useEffect(() => {
    const sections = groups.flatMap((group) => group.items).map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => Boolean(el))
    let frame = 0
    // Ativa = a última secção cujo título já passou abaixo da barra de navegação (+ margem).
    const update = () => {
      frame = 0
      if (Date.now() < lockedUntil.current) return
      let current = sections[0]?.id
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 120) current = section.id
        else break
      }
      if (current) setActive(current)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [groups])

  // Mantém a secção ativa visível no índice (só o índice faz scroll, não a página).
  useEffect(() => {
    const container = nav.current?.parentElement
    const link = nav.current?.querySelector<HTMLElement>(`a[href="#${active}"]`)
    if (!container || !link) return
    const box = container.getBoundingClientRect()
    const item = link.getBoundingClientRect()
    if (item.top < box.top + 24 || item.bottom > box.bottom - 24) {
      container.scrollTo({ top: container.scrollTop + item.top - box.top - box.height / 3 })
    }
  }, [active])

  function go(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    lockedUntil.current = Date.now() + 1000
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    target.scrollIntoView({ behavior, block: 'start' })
    history.replaceState(null, '', `#${id}`)
    setActive(id)
  }

  return (
    <div ref={nav} className="space-y-10">
      {groups.map((group) => {
        const Icon = LEGAL_ICONS[group.icon]
        return (
          <div key={group.title}>
            <p className="mb-3 flex items-center gap-2 px-3 text-[13px] font-semibold text-fg">
              <Icon className="h-4 w-4 text-fg-muted" strokeWidth={1.75} aria-hidden="true" />
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const current = item.id === active
                return (
                  <li key={item.id}>
                    <a href={`#${item.id}`} onClick={(event) => go(event, item.id)} aria-current={current ? 'location' : undefined}
                      className={`block rounded-xs px-3 py-2 text-sm leading-5 transition-colors ${current ? 'bg-surface-2 font-medium text-fg' : 'text-fg-muted hover:text-fg'}`}>
                      {item.title}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
