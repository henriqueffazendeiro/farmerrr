import type { Metadata } from 'next'
import { PricingCards } from '@/components/marketing/pricing-cards'
import { Container } from '@/components/ui/container'

export const metadata: Metadata = {
  title: 'Preços',
  description: 'Um plano só, sem limites de clippers. 25 € por mês, 30 dias grátis.',
}

export default function PricingPage() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-4xl">
            Tudo o que precisas. Num só plano.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-fg-muted">
            Sem complicações. Só tens de escolher como queres começar.
          </p>
        </div>

        <PricingCards />
      </Container>
    </section>
  )
}
