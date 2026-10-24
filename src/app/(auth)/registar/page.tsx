import Link from 'next/link'
import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/auth-form'
import { SetupNotice } from '@/components/auth/setup-notice'
import { signUpAction } from '@/lib/auth/actions'
import { supabaseConfigured } from '@/lib/config/env'

export const metadata: Metadata = { title: 'Criar conta' }

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Cria a tua conta</h1>
      <p className="mt-2 mb-8 text-center text-sm text-fg-muted">
        30 dias grátis.
      </p>

      {supabaseConfigured ? <AuthForm mode="signup" action={signUpAction} /> : <SetupNotice />}

      <p className="mt-8 text-center text-sm text-fg-muted">
        Já tens conta?{' '}
        <Link href="/entrar" className="text-accent underline underline-offset-4 transition-colors hover:text-brand-bright">
          Entra aqui
        </Link>
      </p>

      <p className="mt-6 text-center text-xs leading-relaxed text-fg-subtle">
        Ao criares conta aceitas os{' '}
        <Link href="/legal/termos" className="underline underline-offset-2 hover:text-fg-muted">
          Termos
        </Link>{' '}
        e a{' '}
        <Link href="/legal/privacidade" className="underline underline-offset-2 hover:text-fg-muted">
          Política de Privacidade
        </Link>
        .
      </p>
    </>
  )
}
