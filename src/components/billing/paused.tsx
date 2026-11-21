import Link from 'next/link'
import { PauseCircle } from 'lucide-react'
import { BrandLogo } from '@/components/ui/brand-logo'
import ready from '@/components/dashboard/page-ready.module.css'
import paused from './paused.module.css'
import { startCheckout } from '@/lib/billing/actions'

/** O que um visitante vê quando o streamer não tem subscrição ativa. Os dados ficam guardados. */
export function PausedPage({ name }: { name: string }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
    <PauseCircle className="h-10 w-10 text-fg-subtle" strokeWidth={1.5} aria-hidden="true" />
    <h1 className="mt-5 text-2xl font-semibold tracking-tight">Página em pausa</h1>
    <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">A página de {name} não está disponível de momento. Volta mais tarde.</p>
    <Link href="/" aria-label="farmerrr — página inicial" className="mt-10 opacity-80 transition-opacity hover:opacity-100"><BrandLogo /></Link>
  </main>
}

/**
 * Para o dono, quando a página está em pausa: o mesmo formato do pop-up "Página pronta"
 * (cartão ao centro, fundo desfocado), com o caminho para a subscrição. Não se fecha.
 */
export function OwnerPausedOverlay({ slug }: { slug: string }) {
  return <div className={paused.overlay} role="dialog" aria-modal="true" aria-labelledby="paused-title" aria-describedby="paused-description">
    <div className={`${ready.dialog} ${paused.box}`}>
      <div className={ready.content}>
        <img className={ready.check} src="/paused.webp" alt="" width={128} height={128} />
        <h1 id="paused-title">Página em pausa</h1>
        <p id="paused-description">Ativa a subscrição para voltares a pôr a tua página online.</p>
        {/* Direto para o Checkout do Stripe (mensal, com a opção de mudar para o anual lá dentro). */}
        <form action={startCheckout}>
          <input type="hidden" name="plan" value="monthly" />
          <input type="hidden" name="next" value={`/${slug}`} />
          <button type="submit" className={ready.enter} autoFocus>Ativar subscrição</button>
        </form>
      </div>
    </div>
  </div>
}
