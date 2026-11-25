'use client'

import { useLayoutEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { clipperSignOutAction } from '@/lib/clippers/actions'
import styles from '@/components/dashboard/page-ready.module.css'

export const BAN_GIF = 'https://cdn.7tv.app/emote/01GNDAV6R8000ASVTS4W77SX5G/4x.gif'

function SignOut() {
  const { pending } = useFormStatus()
  return <button type="submit" className={styles.enter} style={{ background: 'var(--color-danger)', color: '#fff' }} disabled={pending} autoFocus>
    {pending ? 'A terminar sessão…' : 'Terminar sessão'}
  </button>
}

/** Clipper banido: aparece sempre que entra na conta e não se pode fechar; só dá para terminar sessão. */
export function BannedPopup({ slug, reason }: { slug: string; reason: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    element?.showModal()
    return () => { element?.close(); document.documentElement.style.overflow = previous }
  }, [])
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="banned-title" aria-describedby="banned-reason"
    onCancel={event => event.preventDefault()}>
    <div className={styles.content}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.check} src={BAN_GIF} alt="" width={96} height={96} />
      <h1 id="banned-title">Banido</h1>
      <p id="banned-reason">{reason ? <>Motivo: {reason}</> : 'Foste banido desta competição.'}</p>
      <form action={clipperSignOutAction}>
        <input type="hidden" name="slug" value={slug} />
        <SignOut />
      </form>
    </div>
  </dialog>
}
