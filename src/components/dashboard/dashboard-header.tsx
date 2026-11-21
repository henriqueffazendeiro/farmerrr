'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { SiteNav } from '@/components/marketing/site-nav'
import { Container } from '@/components/ui/container'

export function DashboardHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // O assistente de criação e a escolha do plano usam o menu da página inicial.
  if (pathname === '/dashboard/novo' || pathname === '/dashboard/subscricao') return <SiteNav />
  if (/^\/dashboard\/l\/[^/]+\/definicoes\/?$/.test(pathname)) return null
  return <header className="border-b border-line/50">{children}</header>
}

export function DashboardMain({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const onboarding = pathname === '/dashboard/novo'
  // A subscrição tem secções a toda a largura (como a página inicial): cada uma traz o seu Container.
  if (pathname === '/dashboard/subscricao') return <main className="min-w-0 flex-1">{children}</main>
  return <main className={onboarding ? 'flex min-w-0 flex-1' : 'min-w-0 flex-1 pt-8 pb-32 sm:pt-10 md:pt-12'}>
    <Container className={onboarding ? 'flex' : undefined}>{children}</Container>
  </main>
}
