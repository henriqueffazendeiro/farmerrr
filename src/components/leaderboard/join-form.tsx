'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const ERRORS: Record<string, string> = {
  indisponivel: 'A ligação ao TikTok ainda não está disponível.',
  cancelado: 'Ligação cancelada. Podes tentar novamente.',
  estado: 'A ligação expirou. Tenta novamente.',
  tiktok: 'Não foi possível ligar a conta. Tenta novamente.',
  fechado: 'As inscrições neste torneio estão fechadas.',
}

export type JoinFormProps = {
  slug: string
  configured: boolean
  available: boolean
  status: string
  erro?: string
  panel?: boolean
}

/** Formulário de participação. Corre no cliente para poder abrir instantaneamente na página do ranking. */
export function JoinForm({ slug, configured, available, status, erro, panel = false }: JoinFormProps) {
  const leaderboard = { status }
  const buttonClass = 'flex h-12 w-full items-center justify-center gap-3 rounded-sm bg-fg text-sm font-medium text-canvas transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <section className={panel ? '' : 'grid min-h-dvh place-items-center px-6 py-12'}>
      <div className={panel ? 'w-full' : 'w-full max-w-[360px]'}>
        {!panel && <Link href={`/${slug}`} className="mb-10 inline-flex items-center gap-2 text-xs text-fg-muted transition-colors hover:text-fg">
          <ArrowLeft size={14} /> Voltar ao torneio
        </Link>}
        {!panel && <h1 className="mb-8 text-2xl font-semibold tracking-tight">Participar</h1>}
        <div>
          {available ? (
            <a href={`/api/auth/tiktok/start?lb=${encodeURIComponent(slug)}`} className={buttonClass}>
              <TikTokIcon /> Entrar com TikTok
            </a>
          ) : (
            <button type="button" disabled aria-describedby="connection-status" className={buttonClass}>
              <TikTokIcon /> Ligar TikTok
            </button>
          )}
          {!available && <p id="connection-status" role="status" className="mt-3 text-xs leading-relaxed text-fg-muted">
            {!configured ? 'A ligação ao TikTok ainda não está disponível.' : leaderboard.status === 'draft' ? 'As inscrições ainda não estão abertas.' : 'As inscrições neste torneio estão encerradas.'}
          </p>}
          {erro && ERRORS[erro] && <p role="alert" className="mt-3 text-sm text-danger">{ERRORS[erro]}</p>}
        </div>
        <Link href="/legal/privacidade" className="mt-5 inline-block text-xs text-fg-subtle underline underline-offset-2 hover:text-fg-muted">Privacidade</Link>
      </div>
    </section>
  )
}

function TikTokIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.7 1h-3.5v14.8a3.1 3.1 0 1 1-2.7-3.1V9.1a6.7 6.7 0 1 0 6.2 6.7V8.3a9.1 9.1 0 0 0 5.3 1.7V6.5A5.5 5.5 0 0 1 16.7 1Z" />
  </svg>
}
