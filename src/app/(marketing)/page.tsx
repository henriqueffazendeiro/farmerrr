import { BackdropWordmark } from '@/components/marketing/backdrop-wordmark'
import { EcosystemStrip } from '@/components/marketing/ecosystem-strip'
import { InteractiveDemo } from '@/components/marketing/interactive-demo'
import { FaqSection } from '@/components/marketing/faq-section'
import { CommunityCta } from '@/components/marketing/community-cta'
import { PricingCards } from '@/components/marketing/pricing-cards'
import { ButtonLink } from '@/components/ui/button'
import { Container } from '@/components/ui/container'

export default function LandingPage() {
  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-28 sm:pb-20">
        <BackdropWordmark />

        <Container className="relative text-center">
          <p className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface/70 px-2.5 py-1 text-[9px] font-medium tracking-[0.12em] text-fg-muted uppercase sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-[11px] sm:tracking-[0.16em]">
            <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
              <span className="relative inline-flex h-full w-full rounded-full bg-accent" />
            </span>
            Construindo em comunidade
          </p>

          {/* "Repercute. Recebe." lado a lado; o remate — "Reage." — leva a cor. */}
          <h1 className="mx-auto mt-6 max-w-4xl text-[clamp(30px,10vw,60px)] leading-[0.95] font-semibold tracking-[-0.045em] text-balance sm:mt-8 sm:text-7xl lg:text-8xl">
            <span className="whitespace-nowrap sm:whitespace-normal">Repercute<span className="hidden sm:inline">.</span> Recebe<span className="hidden sm:inline">.</span></span>
            <br />
            <span className="text-accent">Reage.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-fg-muted sm:mt-8 sm:text-lg">
            Junta os teus clippers numa competição onde cada view conta<span className="sm:hidden">.</span><span className="hidden sm:inline"> — e revive tudo num Recap feito para a tua stream.</span>
          </p>

          <div className="mt-7 flex h-12 w-full items-stretch justify-center gap-2 sm:mt-10 sm:gap-3">
            <ButtonLink href="/registar" size="lg" className="box-border h-full min-w-0 flex-1 border border-transparent bg-clip-padding px-3 text-xs sm:flex-none sm:px-6 sm:text-base">
              Começar
            </ButtonLink>
            <ButtonLink href="#como-funciona" size="lg" variant="secondary" className="box-border h-full min-w-0 flex-1 px-3 text-xs sm:flex-none sm:px-6 sm:text-base">
              Como funciona
            </ButtonLink>
          </div>

          <p className="mt-5 text-sm text-fg-subtle">
            30 dias grátis · cancelas quando quiseres
          </p>
        </Container>
      </section>

      {/* ─── Demo interativa ───────────────────────────────────────────── */}
      <InteractiveDemo />

      {/* ─── Ecossistema ───────────────────────────────────────────────── */}
      <EcosystemStrip />

      {/* ─── Preços ───────────────────────────────────────────────────────── */}
      <section id="precos" className="scroll-mt-20 border-t border-line/50 py-20 sm:py-28">
        <Container>
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
              Tudo o que precisas. Num só plano.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-fg-muted">
              Sem complicações. Só tens de escolher como queres começar.
            </p>
          </div>

          <PricingCards />
        </Container>
      </section>

      <FaqSection />

      {/* ─── CTA final ────────────────────────────────────────────────────── */}
      <CommunityCta />
    </>
  )
}
