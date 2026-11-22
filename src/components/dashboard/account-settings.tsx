import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyCreator, getMyProfile } from '@/lib/db/queries'
import { ProfileImage } from './profile-image'
import { getCurrentUser } from '@/lib/supabase/server'
import { signOutAction } from '@/lib/auth/actions'
import type { ReactNode } from 'react'

export async function AccountSettings({ children }: { children?: ReactNode }) {
  const [profile, user, creator] = await Promise.all([getMyProfile(), getCurrentUser(), getMyCreator()])
  const { data: channels } = creator
    ? await createAdminClient().from('stream_connections').select('platform,channel_name').eq('creator_id', creator.id)
    : { data: [] }

  return (
    <section id="conta" aria-label="Dados da conta e canais" className="scroll-mt-8 mb-6">
      <div>
        <div className="flex items-center gap-6">
        {creator && <ProfileImage src={creator.avatar_url} name={creator.name} />}
        {/* Sem títulos, tudo à esquerda: o nome, o canal de cada plataforma ligada e o email. */}
        <dl className="min-w-0 flex-1 space-y-1 text-sm">
          <dt className="sr-only">Nome da conta</dt>
          <dd className="break-words font-medium">{profile?.display_name || '—'}</dd>
          {channels?.filter(channel => channel.channel_name).map(channel => <div key={channel.platform}>
            <dt className="sr-only">{channel.platform === 'youtube' ? 'YouTube' : channel.platform === 'twitch' ? 'Twitch' : 'Kick'}</dt>
            <dd className="break-all text-fg-muted">@{channel.channel_name?.replace(/^@/, '')}</dd>
          </div>)}
          <dt className="sr-only">Email de acesso</dt>
          <dd className="break-all text-fg-muted">{profile?.email || user?.email || '—'}</dd>
        </dl>
        </div>
        {children}
      </div>
    </section>
  )
}

export function SignOutSettings() {
  return (
    <form action={signOutAction} className="flex items-center">
      <Button type="submit" variant="ghost" size="sm" className="h-8">Terminar sessão</Button>
    </form>
  )
}
