'use client'

import { useActionState, useRef } from 'react'
import { saveClipperDiscordAction, type DiscordState } from '@/lib/clippers/actions'

/** Campo "Discord" das definições do clipper: guarda sozinho ao sair do campo (ou com Enter). */
export function DiscordField({ slug, value, preview = false }: { slug: string; value: string | null; preview?: boolean }) {
  const form = useRef<HTMLFormElement>(null)
  const saved = useRef(value ?? '')
  const [state, action, pending] = useActionState<DiscordState, FormData>(async (previous, data) => {
    if (preview) return { ok: true }
    const result = await saveClipperDiscordAction(previous, data)
    if (result.ok) saved.current = String(data.get('discord') ?? '').trim().replace(/^@/, '')
    return result
  }, {})

  return <form ref={form} action={action}>
    <input type="hidden" name="slug" value={slug} />
    <label htmlFor="discord" className="mb-1.5 block text-xs text-fg-muted">Discord</label>
    <input id="discord" name="discord" defaultValue={value ?? ''} placeholder="nome de utilizador" maxLength={40}
      autoComplete="off" spellCheck={false}
      onBlur={event => { if (event.currentTarget.value.trim() !== saved.current) form.current?.requestSubmit() }}
      className="w-full rounded-sm border-0 bg-surface-2 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:bg-surface-3 focus:bg-surface-3 focus:outline-none" />
    <p role="status" className={`mt-1.5 text-[11px] leading-relaxed ${state.error ? 'text-danger' : 'text-fg-subtle'}`}>
      {pending ? 'A guardar…' : state.error ?? (state.ok ? 'Guardado.' : 'Visível para o streamer, para combinar a entrega dos prémios.')}
    </p>
  </form>
}
