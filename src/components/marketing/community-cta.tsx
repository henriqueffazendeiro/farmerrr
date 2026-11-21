'use client'

import Link from 'next/link'
import { Hyperspace } from '@/components/ui/hyperspace'
import { ButtonLink } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import styles from './community-cta.module.css'

export function CommunityCta() {
  return (
    <section id="comunidade" className={`${styles.section} scroll-mt-20`} aria-labelledby="community-cta-title">
      <Hyperspace className={styles.space} />
      <Container>
        <div className={styles.copy}>
          <h2 id="community-cta-title" className="text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">Pronto para começar?</h2>
          <p>Leva a tua comunidade para além do chat.</p>
          <div className={styles.actions}>
            <ButtonLink href="/entrar?seguinte=/dashboard/novo" size="lg">Começar grátis</ButtonLink>
            <Link href="/#precos" className="rounded-sm px-4 py-2 text-sm text-fg-muted transition-colors hover:text-fg">Ver preços</Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
