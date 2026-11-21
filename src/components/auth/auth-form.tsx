'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import type { AuthState } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Toast } from '@/components/ui/toast'
import { GoogleButton } from './google-button'
import { googleAuthEnabled } from '@/lib/config/env'
import { motion, useReducedMotion } from 'motion/react'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Um momento…' : label}
    </Button>
  )
}

export function AuthForm({
  mode,
  action,
  next,
}: {
  mode: 'signin' | 'signup'
  action: (state: AuthState, formData: FormData) => Promise<AuthState>
  next?: string
}) {
  const reduced = useReducedMotion()
  const router = useRouter()
  const [result, formAction] = useActionState<AuthState & { mode?: string }, FormData>(async (previous, data) => ({
    ...await action(previous, data), mode,
  }), {})
  const state = result.mode === mode ? result : {}
  const waiting = Boolean(state.notice)

  // Cada resposta com erro mostra um aviso novo no topo (id novo reinicia a animação).
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  useEffect(() => {
    if (result.mode === mode && result.error) setToast({ id: Date.now(), message: result.error })
  }, [result, mode])

  // /auth/callback devolve ?erro=… quando o Google (ou o link do email) falha.
  const callbackError = useSearchParams().get('erro')
  useEffect(() => {
    if (callbackError) setToast({ id: Date.now(), message: 'Não foi possível concluir o login. Tenta outra vez.' })
  }, [callbackError])

  // O link do email abre num separador novo. Este fica à espera da sessão e
  // segue sozinho, para não deixar o utilizador num ecrã morto.
  useEffect(() => {
    if (!waiting) return
    let stopped = false
    const check = async () => {
      if (stopped || document.hidden) return
      try {
        const response = await fetch('/api/auth/estado', { cache: 'no-store' })
        const { pronto } = await response.json()
        if (pronto && !stopped) { stopped = true; router.replace(next?.startsWith('/') ? next : '/dashboard') }
      } catch { /* Sem rede: tenta outra vez no próximo intervalo. */ }
    }
    const timer = setInterval(check, 3000)
    document.addEventListener('visibilitychange', check)
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [waiting, next, router])

  if (state.notice) {
    return (
      <div className="rounded-md border border-live/25 bg-live/8 p-5 text-center">
        <MailCheck className="mx-auto h-6 w-6 text-live" strokeWidth={1.8} />
        <p className="mt-3 text-sm leading-relaxed text-fg">{state.notice}</p>
        <p className="mt-2 text-xs text-fg-muted">Depois de confirmares, esta página segue sozinha.</p>
      </div>
    )
  }

  return (
    <>
    {googleAuthEnabled && <>
      <GoogleButton next={next} onError={(message) => setToast({ id: Date.now(), message })} />
      <div className="my-6 flex items-center gap-3 text-xs text-fg-subtle" aria-hidden="true">
        <span className="h-px flex-1 bg-line-strong" />ou<span className="h-px flex-1 bg-line-strong" />
      </div>
    </>}
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="tu@exemplo.com"
        required
      />

      <div>
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        placeholder={mode === 'signup' ? 'Pelo menos 8 caracteres' : '••••••••'}
        minLength={8}
        required
      />

      <motion.div initial={false} animate={{ height: mode === 'signup' ? 'auto' : 0 }}
        transition={{ duration: reduced ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="overflow-hidden" inert={mode !== 'signup'} aria-hidden={mode !== 'signup'}>
        <Field
          className="pt-4"
          label="Confirmar password"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repete a password"
          minLength={8}
          required={mode === 'signup'}
          disabled={mode !== 'signup'}
        />
      </motion.div>
      </div>

      <Submit label={mode === 'signup' ? 'Criar conta' : 'Entrar'} />
    </form>
    {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
    </>
  )
}
