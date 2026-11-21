'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { AuthForm } from './auth-form'
import { SetupNotice } from './setup-notice'
import { signInAction, signUpAction } from '@/lib/auth/actions'

/** Conteúdo do popup de entrar/registar. O modo vem do pathname (/entrar ou /registar). */
export function AuthPanel({ configured }: { configured: boolean }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const reduced = useReducedMotion()
  const signup = pathname === '/registar'
  const query = params.size ? `?${params}` : ''

  // Alternar só muda o URL (o Next sincroniza usePathname com history.replaceState):
  // sem navegação, o popup não é intercetado outra vez nem empilha histórico.
  function switchTo(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    window.history.replaceState(null, '', href)
  }

  return <div>
    <nav aria-label="Entrar ou registar" className="mb-8 flex justify-center gap-6">
      {([['/entrar', 'Entrar', !signup], ['/registar', 'Registar', signup]] as const).map(([path, label, active]) =>
        <a key={path} href={`${path}${query}`} onClick={(event) => switchTo(event, `${path}${query}`)} aria-current={active ? 'page' : undefined}
          className={`border-b-2 pb-2 text-lg font-medium transition-colors ${active ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg'}`}>
          {label}
        </a>)}
    </nav>
    {configured ? <AuthForm mode={signup ? 'signup' : 'signin'} action={signup ? signUpAction : signInAction} next={params.get('seguinte') ?? undefined} /> : <SetupNotice />}
    <motion.div initial={false} animate={{ height: signup ? 'auto' : 0 }} transition={{ duration: reduced ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden" inert={!signup} aria-hidden={!signup}>
      <p className="pt-6 text-center text-xs leading-relaxed text-fg-subtle">
        Ao criares conta aceitas os{' '}<Link href="/legal/termos" className="underline underline-offset-2 hover:text-fg-muted">Termos</Link>{' '}
        e a{' '}<Link href="/legal/privacidade" className="underline underline-offset-2 hover:text-fg-muted">Política de Privacidade</Link>.
      </p>
    </motion.div>
  </div>
}
