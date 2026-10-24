import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CreatorOnboarding } from '@/components/dashboard/creator-onboarding'
import { getMyCreator, getMyProfile } from '@/lib/db/queries'

export const metadata: Metadata = { title: 'Começar' }

export default async function OnboardingPage() {
  const creator = await getMyCreator()
  if (creator) redirect('/dashboard')

  const profile = await getMyProfile()

  return (
    <div className="mx-auto max-w-[420px] py-8 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Vamos começar</h1>
      <p className="mt-2 mb-8 text-sm leading-relaxed text-fg-muted">
        Só precisamos do teu nome de creator e do endereço onde queres o leaderboard. Podes
        mudar depois.
      </p>

      <CreatorOnboarding suggestedName={profile?.display_name ?? ''} />
    </div>
  )
}
