'use client'

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import styles from './settings-drawer.module.css'

export function SettingsDrawer({ children, onClose, title = 'Definições', closeLabel = 'Fechar definições', fill = false }: { children: ReactNode; onClose?: () => void; title?: string; closeLabel?: string; /** O conteúdo ocupa a altura toda (para encostar partes ao fundo). */ fill?: boolean }) {
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [closing, setClosing] = useState(false)
  const router = useRouter()

  useLayoutEffect(() => {
    const element = dialog.current
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    element?.showModal()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      element?.close()
      root.style.overflow = previousOverflow
    }
  }, [])

  function close() {
    if (closing) return
    setClosing(true)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160
    timer.current = setTimeout(() => onClose ? onClose() : router.back(), duration)
  }

  return (
    <dialog ref={dialog} className={styles.drawer} data-closing={closing} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); close() }}
      onClick={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className={fill ? `${styles.content} ${styles.contentFill}` : styles.content}>
        <header className="mb-10 flex items-center justify-between gap-6">
          <h1 id={titleId} className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <button type="button" onClick={close} aria-label={closeLabel} className="grid h-9 w-9 shrink-0 place-items-center rounded-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
