'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, MailCheck } from 'lucide-react'
import type { AuthState } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'

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
  const [state, formAction] = useActionState<AuthState, FormData>(action, {})

  if (state.notice) {
    return (
      <div className="rounded-md border border-live/25 bg-live/8 p-5 text-center">
        <MailCheck className="mx-auto h-6 w-6 text-live" strokeWidth={1.8} />
        <p className="mt-3 text-sm leading-relaxed text-fg">{state.notice}</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {mode === 'signup' && (
        <Field
          label="Como te chamas"
          name="displayName"
          autoComplete="name"
          placeholder="Luís Ferreira"
          required
        />
      )}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="tu@exemplo.com"
        required
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        placeholder={mode === 'signup' ? 'Pelo menos 8 caracteres' : '••••••••'}
        minLength={8}
        required
      />

      {state.error && (
        <p className="flex items-start gap-2 rounded-sm border border-danger/25 bg-danger/8 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          {state.error}
        </p>
      )}

      <Submit label={mode === 'signup' ? 'Criar conta' : 'Entrar'} />
    </form>
  )
}
