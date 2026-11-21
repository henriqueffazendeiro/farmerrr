import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SetupWizard } from '@/components/dashboard/setup-wizard'
import { SiteNav } from '@/components/marketing/site-nav'
import { Container } from '@/components/ui/container'

export const metadata: Metadata = { title: 'Pré-visualizar configuração', robots: { index: false, follow: false } }

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <div className="flex min-h-dvh flex-col">
    <SiteNav />
    <main className="flex min-w-0 flex-1">
      <Container className="flex"><SetupWizard previewSlug="dashboard" /></Container>
    </main>
  </div>
}
