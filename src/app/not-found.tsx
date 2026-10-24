import Link from 'next/link'
import { Wordmark } from '@/components/ui/wordmark'

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="text-center">
        <Link href="/" className="inline-flex">
          <Wordmark size="lg" />
        </Link>
        <p className="nums mt-10 text-6xl font-semibold tracking-tight text-fg-subtle">404</p>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Este leaderboard não existe ou já não está público.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm text-accent underline underline-offset-4 transition-colors hover:text-brand-bright"
        >
          ← Voltar ao início
        </Link>
      </div>
    </main>
  )
}
