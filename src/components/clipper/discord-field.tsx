'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { saveClipperContactAction, type ContactState } from '@/lib/clippers/actions'
import { SaveFooter } from '@/components/ui/save-footer'

const normalizeDiscord = (value: string) => value.trim().replace(/^@/, '')
const normalizeEmail = (value: string) => value.trim().toLowerCase()

function Field({ name, label, value, onChange, placeholder, hint, error, maxLength, type = 'text' }: {
  name: string; label: string; value: string; onChange: (value: string) => void; placeholder: string
  hint: string; error?: string; maxLength: number; type?: 'text' | 'email'
}) {
  return <div className="mt-5 first:mt-0">
    <label htmlFor={name} className="mb-1.5 block text-xs text-fg-muted">{label}</label>
    <input id={name} name={name} type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}
      maxLength={maxLength} autoComplete={type === 'email' ? 'email' : 'off'} spellCheck={false} aria-invalid={error ? true : undefined}
      className="w-full rounded-sm border-0 bg-surface-2 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:bg-surface-3 focus:bg-surface-3 focus:outline-none" />
    <p className={`mt-1.5 text-[11px] leading-relaxed ${error ? 'text-danger' : 'text-fg-subtle'}`}>{error ?? hint}</p>
  </div>
}

/**
 * Discord (visível para o streamer) e email (privado) do clipper, guardados com a barra
 * "Guardar alterações" em baixo, como nas definições do streamer.
 */
export function ClipperContactForm({ slug, discord, email, preview }: { slug: string; discord: string | null; email: string | null; preview?: boolean }) {
  const router = useRouter()
  const [values, setValues] = useState({ discord: discord ?? '', email: email ?? '' })
  const snapshot = (v: typeof values) => JSON.stringify([normalizeDiscord(v.discord), normalizeEmail(v.email)])
  const [saved, setSaved] = useState(() => snapshot(values))
  const dirty = snapshot(values) !== saved
  const [state, action] = useActionState<ContactState, FormData>(async (previous, data) => {
    const submitted = snapshot({ discord: String(data.get('discord') ?? ''), email: String(data.get('email') ?? '') })
    const result = preview ? { ok: true } : await saveClipperContactAction(previous, data)
    if (result.ok) {
      setSaved(submitted)
      if (!preview) router.refresh()
    }
    return result
  }, {})

  return <form action={action}>
    <input type="hidden" name="slug" value={slug} />
    <Field name="discord" label="Discord" value={values.discord} onChange={discord => setValues(v => ({ ...v, discord }))}
      placeholder="nome de utilizador" maxLength={40} error={state.errors?.discord}
      hint="Visível para o streamer combinar a entrega dos prémios." />
    <Field name="email" type="email" label="Email" value={values.email} onChange={email => setValues(v => ({ ...v, email }))}
      placeholder="nome@exemplo.com" maxLength={254} error={state.errors?.email}
      hint="Privado, só para avisar de prémios para levantar." />
    {state.error && <p className="mt-5 flex items-start gap-2 rounded-sm border border-danger/25 bg-danger/8 px-3 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />{state.error}
    </p>}
    <SaveFooter label="Guardar alterações" dirty={dirty} saved={Boolean(state.ok) && !dirty} />
  </form>
}
