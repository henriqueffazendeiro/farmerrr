import { Suspense } from 'react'
import { AuthModal } from '@/components/auth/auth-modal'
import { AuthPanel } from '@/components/auth/auth-panel'
import { supabaseConfigured } from '@/lib/config/env'

// Navegação dentro do site para /entrar ou /registar: o popup abre por cima da página atual.
export default function AuthModalLayout({ children }: { children: React.ReactNode }) {
  return <AuthModal>
    <Suspense fallback={null}><AuthPanel configured={supabaseConfigured} /></Suspense>
    {children}
  </AuthModal>
}
