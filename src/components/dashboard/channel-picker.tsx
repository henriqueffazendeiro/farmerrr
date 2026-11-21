'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { streamLabels, type StreamPlatform } from '@/lib/streams/model'
import { cn } from '@/lib/utils'
import styles from './channel-picker.module.css'

type ChannelOption = {
  platform: StreamPlatform
  configured: boolean
  connection: {
    id: string
    channel_name: string
    channel_url: string
    status: string
    mode: 'public' | 'oauth'
    last_checked_at: string | null
    last_error: string | null
  } | null
}

export function ChannelPicker({ options, initialNotice }: { options: ChannelOption[]; initialNotice?: string }) {
  const [selected, setSelected] = useState<StreamPlatform | null>(() => options.find(item => item.connection)?.platform ?? null)
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState(initialNotice ?? '')
  const [failed, setFailed] = useState(false)
  const router = useRouter()
  const picker = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const option = options.find((item) => item.platform === selected)
  const connection = option?.connection
  async function connect(event: FormEvent) {
    event.preventDefault()
    if (!selected || pending) return
    setPending(true); setNotice(''); setFailed(false)
    try {
      const response = await fetch('/api/streams/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: selected, channel }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível ligar o canal.')
      setNotice(result.message); setChannel(''); router.refresh()
    } catch (error) { setFailed(true); setNotice(error instanceof Error ? error.message : 'Não foi possível ligar o canal.') }
    finally { setPending(false) }
  }

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    picker.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
    if (!selected) picker.current?.querySelector<HTMLElement>('[role="option"]')?.focus()
    return () => document.removeEventListener('pointerdown', close)
  }, [open, selected])

  return (
    <div>
      <div className="flex items-center gap-3">
      <div ref={picker} className="relative min-w-0 flex-1" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}>
        <button ref={trigger} type="button" disabled={pending} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
          aria-label={selected ? `Plataforma: ${streamLabels[selected]}` : 'Selecionar plataforma'}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
          }}
          className="flex h-10 w-full items-center gap-2 rounded-sm border-0 bg-surface-2 px-4 text-left text-sm transition-colors hover:bg-surface-3">
          {selected && <Image src={`/platforms/${selected}.svg`} alt="" width={20} height={20} className="h-5 w-5 invert" />}
          <span className="min-w-0 flex-1 truncate">{selected ? streamLabels[selected] : 'Selecionar plataforma'}</span>
          <ChevronDown aria-hidden="true" className={cn('h-4 w-4 text-fg-muted transition-transform', open && 'rotate-180')} />
        </button>
        {open && <div id={listId} role="listbox" aria-label="Plataformas" className={cn(styles.dropdown, 'absolute inset-x-0 top-full z-20 mt-2 rounded-sm border-0 bg-surface-2 p-1 shadow-lg')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); return }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'))
            const current = items.indexOf(document.activeElement as HTMLButtonElement)
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            items[next]?.focus()
          }}>
          {options.map(({ platform, connection }) => <button key={platform} type="button" role="option" aria-selected={selected === platform}
            onClick={() => { setSelected(platform); setChannel(''); setNotice(''); setOpen(false); trigger.current?.focus() }}
            className={cn('flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left text-sm hover:bg-surface-3 focus:bg-surface-3', selected === platform && 'bg-surface-3')}>
            <Image src={`/platforms/${platform}.svg`} alt="" width={20} height={20} className="h-5 w-5 invert" />
            <span className="flex-1">{streamLabels[platform]}</span>
            {connection?.status === 'connected' && <span className="text-xs text-fg-muted">Ligado</span>}
            {selected === platform && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
          </button>)}
        </div>}
      </div>

      </div>
      {option && !connection && <form onSubmit={connect} className="mt-3 space-y-3">
        <label htmlFor={`${listId}-channel`} className="sr-only">Username ou URL do canal</label>
        <input id={`${listId}-channel`} name="channel" value={channel} onChange={event => setChannel(event.target.value)}
          placeholder={selected === 'youtube' ? '@canal ou URL do YouTube' : `Username ou URL da ${selected === 'kick' ? 'Kick' : 'Twitch'}`}
          required maxLength={200} autoCapitalize="none" autoComplete="off" spellCheck={false} disabled={pending || !option.configured}
          className="h-10 w-full rounded-sm border-0 bg-surface-2 px-4 text-sm outline-none transition-colors hover:bg-surface-3 focus:bg-surface-3 disabled:opacity-40" />
        <Button type="submit" size="sm" className="h-10 w-full" disabled={pending || !channel.trim() || !option.configured}>{pending ? 'A ligar canal…' : 'Conectar'}</Button>
        {!option.configured && <p className="text-xs text-fg-muted">A ligação de canais ainda não está disponível.</p>}
      </form>}
      {notice && <p role={failed ? 'alert' : 'status'} className={cn('mt-2 text-xs', failed ? 'text-danger' : 'text-fg-muted')}>{notice}</p>}
      {connection && <p className="mt-1.5 text-xs text-fg-muted" aria-live="polite">
        <a href={connection.channel_url} target="_blank" rel="noopener noreferrer" className="hover:text-fg">{connection.channel_name}</a>
        {' · '}{connection.status !== 'connected' ? 'Precisa de autorização' : connection.mode === 'oauth' ? 'Autorizado pela plataforma' : 'Ligado'}
      </p>}
      {connection?.last_error && <p role="alert" className="mt-2 text-xs text-danger">{connection.last_error}</p>}
    </div>
  )
}
