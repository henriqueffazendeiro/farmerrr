'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { X } from 'lucide-react'
import { CelebrationConfetti } from './celebration-confetti'
import styles from './page-ready.module.css'

type Props = {
  title?: string
  description?: string
  action?: string
  /** Parâmetros do endereço que abriram o pop-up (saem ao abrir, para não voltar a aparecer ao atualizar). */
  param?: string | string[]
  /** Imagem do topo (por defeito o gato). */
  image?: string
  /** Animação: papelinhos (por defeito) ou notas. */
  celebration?: 'confetti' | 'money'
  /** O botão principal envia este formulário (ex.: "Levantar"), em vez de só fechar o pop-up. */
  submit?: { action: (form: FormData) => void | Promise<void>; fields: Record<string, string>; pendingLabel?: string }
  /** Depois de fechado, não volta a aparecer neste browser enquanto a chave for a mesma. */
  dismissKey?: string
}

function SubmitAction({ label, pendingLabel }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" className={styles.enter} disabled={pending} autoFocus>{pending ? pendingLabel ?? label : label}</button>
}

/** Pop-up de celebração: "Página pronta" para o streamer; também usado quando um clipper entra na competição. */
export function PageReady({ title = 'Página pronta', description = 'Está tudo preparado para receber a comunidade.', action = 'Ver página', param = 'criada', image = '/popcat.webp', celebration = 'confetti', submit, dismissKey }: Props = {}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [closed, setClosed] = useState(false)
  const [notice, setNotice] = useState('')
  const params = [param].flat().join(',')

  const close = () => {
    if (dismissKey) try { localStorage.setItem(dismissKey, '1') } catch { /* Storage may be disabled. */ }
    setClosed(true)
  }

  useLayoutEffect(() => {
    if (closed) return
    if (dismissKey) {
      let dismissed = false
      try { dismissed = localStorage.getItem(dismissKey) === '1' } catch { /* Storage may be disabled. */ }
      if (dismissed) { setClosed(true); return }
    }
    const element = dialog.current
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    element?.showModal()
    try {
      setNotice(sessionStorage.getItem('onboarding-notice') ?? '')
      sessionStorage.removeItem('onboarding-notice')
    } catch { /* Storage may be disabled. */ }
    const url = new URL(window.location.href)
    const names = params.split(',')
    if (names.some(name => url.searchParams.has(name))) {
      names.forEach(name => url.searchParams.delete(name))
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
    return () => { element?.close(); document.documentElement.style.overflow = previous }
  }, [closed, params, dismissKey])

  if (closed) return null
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="page-ready-title" aria-describedby="page-ready-description"
    onCancel={event => { event.preventDefault(); close() }}>
    <CelebrationConfetti variant={celebration} />
    <div className={styles.content}>
      <button type="button" className={styles.close} aria-label="Fechar" onClick={close}><X size={18} /></button>
      <img className={styles.check} src={image} alt="" width={128} height={128} />
      <h1 id="page-ready-title">{title}</h1>
      <p id="page-ready-description">{description}</p>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {submit ? <form action={submit.action} onSubmit={() => { if (dismissKey) try { localStorage.setItem(dismissKey, '1') } catch { /* Storage may be disabled. */ } }}>
        {Object.entries(submit.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        <SubmitAction label={action} pendingLabel={submit.pendingLabel} />
      </form> : <button type="button" className={styles.enter} onClick={close} autoFocus>{action}</button>}
    </div>
  </dialog>
}
