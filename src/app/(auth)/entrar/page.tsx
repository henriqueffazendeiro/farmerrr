import Link from 'next/link'
import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/auth-form'
import { SetupNotice } from '@/components/auth/setup-notice'
import { signInAction } from '@/lib/auth/actions'
import { supabaseConfigured } from '@/lib/config/env'

export const metadata: Metadata = { title: 'Entrar' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ seguinte?: string }>
}) {
  const { seguinte } = await searchParams

  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-2 mb-8 text-center text-sm text-fg-muted">
        Entra para gerires os teus leaderboards.
      </p>

      {supabaseConfigured ? (
        <AuthForm mode="signin" action={signInAction} next={seguinte} />
      ) : (
        <SetupNotice />
      )}

      <p className="mt-8 text-center text-sm text-fg-muted">
        Ainda não tens conta?{' '}
        <Link href="/registar" className="text-accent underline underline-offset-4 transition-colors hover:text-brand-bright">
          Cria uma
        </Link>
      </p>
    </>
  )
}
