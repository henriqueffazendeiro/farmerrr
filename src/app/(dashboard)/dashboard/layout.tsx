import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BrandLogo } from '@/components/ui/brand-logo'
import { Container } from '@/components/ui/container'
import { getCurrentUser } from '@/lib/supabase/server'
import { SignOutSettings } from '@/components/dashboard/account-settings'
import { DashboardHeader, DashboardMain } from '@/components/dashboard/dashboard-header'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar?seguinte=/dashboard')

  return (
    <div className="flex min-h-dvh flex-col">
      <DashboardHeader>
        <Container className="flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
          <Link href="/" aria-label="farmerrr — página inicial" className="inline-flex h-8 items-center"><BrandLogo /></Link>
          <nav aria-label="Área do criador" className="flex items-center gap-5 text-sm text-fg-muted">
            <SignOutSettings />
          </nav>
        </Container>
      </DashboardHeader>
      <DashboardMain>{children}</DashboardMain>
    </div>
  )
}
