'use client'

import { useLayoutEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { banClipperAction } from '@/lib/leaderboards/admin-actions'
import styles from '@/components/dashboard/page-ready.module.css'
import ban from './ban-clipper-dialog.module.css'
import { BAN_GIF } from '@/components/clipper/banned-popup'

/** Pop-up do streamer para banir um clipper (por tempo indeterminado): só pede o motivo. */
export function BanClipperDialog({ leaderboardId, participantId, name, onClose }: { leaderboardId: string; participantId: string; name: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useLayoutEffect(() => {
    const element = dialog.current
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    element?.showModal()
    return () => { element?.close(); document.documentElement.style.overflow = previous }
  }, [])

  const close = () => { if (!pending) onClose() }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) { setError('Escreve o motivo do banimento.'); return }
    setError('')
    startTransition(async () => {
      const result = await banClipperAction(leaderboardId, participantId, { reason: reason.trim() })
        .catch(() => ({ ok: false as const, error: 'Não foi possível banir o clipper. Tenta novamente.' }))
      if (!result.ok) { setError(result.error); return }
      onClose(); router.refresh()
    })
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="ban-title" onCancel={event => { event.preventDefault(); close() }}>
    <form className={`${styles.content} ${ban.form}`} onSubmit={submit}>
      <button type="button" className={styles.close} aria-label="Fechar" onClick={close}><X size={18} /></button>
      <h1 id="ban-title" className={ban.title}>Banir {name}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={ban.gif} src={BAN_GIF} alt="" width={96} height={96} />

      <label className={ban.label} htmlFor="ban-reason">Motivo do banimento</label>
      <textarea id="ban-reason" className={ban.field} value={reason} onChange={event => setReason(event.target.value)}
        rows={3} maxLength={500} required disabled={pending} placeholder="Ex.: clips roubados de outros clippers" autoFocus />

      {error && <p role="alert" className={ban.error}>{error}</p>}
      <button type="submit" className={`${styles.enter} ${ban.submit}`} disabled={pending}>{pending ? 'A banir…' : 'Banir'}</button>
    </form>
  </dialog>
}
