'use client'

import { useEffect, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'
import { signOutAction } from '@/lib/auth/actions'

/**
 * "Login" ou "Logout" no menu, conforme a sessão. A sessão é lida no browser para as páginas
 * públicas continuarem estáticas (rápidas). Enquanto não se sabe, o botão fica invisível (sem saltos).
 */
export function AuthNavButton() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>
    try { supabase = createClient() } catch { setSignedIn(false); return }
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)))
    return () => data.subscription.unsubscribe()
  }, [])

  if (signedIn) return <form action={signOutAction}><Button type="submit" size="sm">Logout</Button></form>
  return <ButtonLink href="/entrar?seguinte=/dashboard/novo" size="sm" className={signedIn === null ? 'invisible' : undefined}>Login</ButtonLink>
}
