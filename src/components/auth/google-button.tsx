'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  )
}

/** Login social via Supabase Auth: vai ao Google e volta por /auth/callback. */
export function GoogleButton({ next, onError }: { next?: string; onError: (message: string) => void }) {
  const [pending, setPending] = useState(false)

  async function signIn() {
    setPending(true)
    const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}` },
    })
    // Sem erro, o browser já está a sair para o Google.
    if (error) {
      setPending(false)
      onError('Não foi possível entrar com Google. Tenta outra vez.')
    }
  }

  return (
    <Button type="button" variant="secondary" size="lg" className="w-full" onClick={signIn} disabled={pending}>
      <GoogleLogo />
      {pending ? 'A abrir o Google…' : 'Continuar com Google'}
    </Button>
  )
}
