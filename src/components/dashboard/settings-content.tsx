import { notFound, redirect } from 'next/navigation'
import { LeaderboardForm } from '@/components/dashboard/leaderboard-form'
import { StreamConnections } from '@/components/dashboard/stream-connections'
import { AccountSettings } from '@/components/dashboard/account-settings'
import { ProfileImageDraft } from '@/components/dashboard/profile-image-draft'
import { getMyCreator, getOwnedLeaderboard, getRewards } from '@/lib/db/queries'
import {
  updateLeaderboardAction,
} from '@/lib/leaderboards/actions'
import { Button } from '@/components/ui/button'
import { signOutAction } from '@/lib/auth/actions'
import { openBillingPortal } from '@/lib/billing/actions'
import { StreamerPrizes } from '@/components/prizes/streamer-prizes'

export async function SettingsContent({ id, streams, premios }: { id: string; streams?: string; premios?: string }) {
  const [leaderboard, creator] = await Promise.all([getOwnedLeaderboard(id), getMyCreator()])
  if (!leaderboard) notFound()
  if (!creator) redirect('/dashboard/inicio')

  const [rewards, account, prizes] = await Promise.all([
    getRewards(id),
    StreamConnections({ creatorId: creator.id, notice: streams }).then(children => AccountSettings({ children })),
    StreamerPrizes({ board: leaderboard, notice: premios }),
  ])

  return (
    <ProfileImageDraft>
      {account}
      <LeaderboardForm
        mode="edit"
        action={updateLeaderboardAction}
        creatorName={creator.name}
        defaultSlug={creator.handle}
        leaderboard={leaderboard}
        rewards={rewards}
      />

      {prizes}

      {/* ─── Conta ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="conta-title" className="mt-6 pt-6">
        <h3 id="conta-title" className="mb-1.5 text-xs text-fg-muted">Conta</h3>
        <div className="grid grid-cols-2 gap-2">
          <form action={openBillingPortal}><Button type="submit" variant="secondary" className="w-full border-0">Gerir subscrição</Button></form>
          <form action={signOutAction}><Button type="submit" variant="danger" className="w-full border-0 bg-danger/10 hover:bg-danger/20">Terminar sessão</Button></form>
        </div>
      </section>
    </ProfileImageDraft>
  )
}
