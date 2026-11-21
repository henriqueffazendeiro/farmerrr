'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import styles from './auth-modal.module.css'

/**
 * Popup de entrar/registar. Dentro do site abre por cima da página atual (rota
 * intercetada em @panel) e fechar volta atrás; num acesso direto a /entrar não há
 * página anterior no site, por isso fecha para `closeHref`.
 */
export function AuthModal({ children, closeHref }: { children: ReactNode; closeHref?: string }) {
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
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150
    timer.current = setTimeout(() => closeHref ? router.replace(closeHref, { scroll: false }) : router.back(), duration)
  }

  return (
    <dialog ref={dialog} className={styles.modal} data-closing={closing} aria-label="Entrar ou criar conta"
      onCancel={(event) => { event.preventDefault(); close() }}
      onClick={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className={styles.content}>
        <button type="button" onClick={close} aria-label="Fechar" className={`${styles.close} grid h-9 w-9 place-items-center rounded-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg`}>
          <X className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </button>
        {children}
      </div>
    </dialog>
  )
}
