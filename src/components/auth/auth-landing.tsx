import { Suspense } from 'react'
import LandingPage from '@/app/(marketing)/page'
import { AuthModal } from './auth-modal'
import { AuthPanel } from './auth-panel'
import { supabaseConfigured } from '@/lib/config/env'

/** Acesso direto a /entrar ou /registar: a página inicial com o popup aberto por cima. */
export function AuthLanding() {
  return <>
    <LandingPage />
    <AuthModal closeHref="/">
      <Suspense fallback={null}><AuthPanel configured={supabaseConfigured} /></Suspense>
    </AuthModal>
  </>
}
