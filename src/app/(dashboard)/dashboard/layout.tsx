import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/sidebar'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMyCreator } from '@/lib/db/queries'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/entrar?seguinte=/dashboard')

  const creator = await getMyCreator()

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar creatorName={creator?.name ?? null} />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  )
}
