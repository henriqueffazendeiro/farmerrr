'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import styles from './toast.module.css'

/** Aviso que desce do topo da página e sobe sozinho passado uns segundos. */
export function Toast({ message, onDone, duration = 4000 }: { message: string; onDone: () => void; duration?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)

  useLayoutEffect(() => {
    const element = ref.current
    // Um frame depois: se um <dialog> do mesmo render abrir agora (os efeitos dos filhos
    // correm primeiro), o aviso entra na camada de topo depois dele e fica por cima.
    const frame = requestAnimationFrame(() => {
      try { element?.showPopover() } catch { /* Sem suporte a popover: fica como elemento fixo normal. */ }
    })
    return () => {
      cancelAnimationFrame(frame)
      try { element?.hidePopover() } catch { /* já fechado */ }
    }
  }, [])

  useEffect(() => {
    const hide = setTimeout(() => setLeaving(true), duration)
    return () => clearTimeout(hide)
  }, [duration])

  return (
    <div ref={ref} popover="manual" role="alert" className={styles.toast} data-leaving={leaving}
      onAnimationEnd={() => { if (leaving) onDone() }}>
      <AlertCircle className={styles.icon} strokeWidth={2} aria-hidden="true" />
      {message}
    </div>
  )
}
