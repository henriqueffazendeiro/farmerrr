import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteNav } from '@/components/marketing/site-nav'
import { PageNavigation } from '@/components/marketing/page-navigation'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageNavigation><div className="relative flex min-h-dvh flex-col">
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div></PageNavigation>
  )
}
