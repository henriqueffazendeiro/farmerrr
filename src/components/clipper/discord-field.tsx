'use client'

import { useActionState, useRef } from 'react'
import { saveClipperDiscordAction, saveClipperEmailAction, type DiscordState } from '@/lib/clippers/actions'

type FieldProps = { slug: string; value: string | null; preview?: boolean }

/** Campo das definições do clipper que guarda sozinho ao sair do campo (ou com Enter). */
function AutoSaveField({ slug, value, preview, name, label, placeholder, hint, maxLength, type = 'text', save, normalize }: FieldProps & {
  name: string; label: string; placeholder: string; hint: string; maxLength: number; type?: 'text' | 'email'
  save: (previous: DiscordState, form: FormData) => Promise<DiscordState>; normalize: (value: string) => string
}) {
  const form = useRef<HTMLFormElement>(null)
  const saved = useRef(value ?? '')
  const [state, action, pending] = useActionState<DiscordState, FormData>(async (previous, data) => {
    if (preview) return { ok: true }
    const result = await save(previous, data)
    if (result.ok) saved.current = normalize(String(data.get(name) ?? ''))
    return result
  }, {})

  return <form ref={form} action={action} className="mt-5 first:mt-0">
    <input type="hidden" name="slug" value={slug} />
    <label htmlFor={name} className="mb-1.5 block text-xs text-fg-muted">{label}</label>
    <input id={name} name={name} type={type} defaultValue={value ?? ''} placeholder={placeholder} maxLength={maxLength}
      autoComplete={type === 'email' ? 'email' : 'off'} spellCheck={false}
      onBlur={event => { if (normalize(event.currentTarget.value) !== saved.current) form.current?.requestSubmit() }}
      className="w-full rounded-sm border-0 bg-surface-2 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:bg-surface-3 focus:bg-surface-3 focus:outline-none" />
    <p role="status" className={`mt-1.5 text-[11px] leading-relaxed ${state.error ? 'text-danger' : 'text-fg-subtle'}`}>
      {pending ? 'A guardar…' : state.error ?? (state.ok ? 'Guardado.' : hint)}
    </p>
  </form>
}

/** "Discord": visível para o streamer, para combinar a entrega dos prémios. */
export function DiscordField(props: FieldProps) {
  return <AutoSaveField {...props} name="discord" label="Discord" placeholder="nome de utilizador" maxLength={40}
    hint="Visível para o streamer, para combinar a entrega dos prémios." save={saveClipperDiscordAction}
    normalize={value => value.trim().replace(/^@/, '')} />
}

/** "Email": privado, só para avisar quando houver um prémio para levantar. */
export function EmailField(props: FieldProps) {
  return <AutoSaveField {...props} name="email" type="email" label="Email" placeholder="nome@exemplo.com" maxLength={254}
    hint="Só para avisar quando houver um prémio para levantar. Não é mostrado a ninguém." save={saveClipperEmailAction}
    normalize={value => value.trim().toLowerCase()} />
}
