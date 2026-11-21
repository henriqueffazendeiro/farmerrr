'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { CelebrationConfetti } from './celebration-confetti'
import styles from './page-ready.module.css'

export function PageReady() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [closed, setClosed] = useState(false)
  const [notice, setNotice] = useState('')

  useLayoutEffect(() => {
    if (closed) return
    const element = dialog.current
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    element?.showModal()
    try {
      setNotice(sessionStorage.getItem('onboarding-notice') ?? '')
      sessionStorage.removeItem('onboarding-notice')
    } catch { /* Storage may be disabled. */ }
    const url = new URL(window.location.href)
    if (url.searchParams.has('criada')) {
      url.searchParams.delete('criada')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
    return () => { element?.close(); document.documentElement.style.overflow = previous }
  }, [closed])

  if (closed) return null
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="page-ready-title" aria-describedby="page-ready-description"
    onCancel={event => { event.preventDefault(); setClosed(true) }}>
    <CelebrationConfetti />
    <div className={styles.content}>
      <button type="button" className={styles.close} aria-label="Fechar" onClick={() => setClosed(true)}><X size={18} /></button>
      <img className={styles.check} src="/popcat.webp" alt="" width={128} height={128} />
      <h1 id="page-ready-title">Página pronta</h1>
      <p id="page-ready-description">Está tudo preparado para receberes a tua comunidade.</p>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <button type="button" className={styles.enter} onClick={() => setClosed(true)} autoFocus>Ver página</button>
    </div>
  </dialog>
}
