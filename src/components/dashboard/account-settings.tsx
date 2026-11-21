import { Button } from '@/components/ui/button'
import { getMyCreator, getMyProfile } from '@/lib/db/queries'
import { ProfileImage } from './profile-image'
import { getCurrentUser } from '@/lib/supabase/server'
import { signOutAction } from '@/lib/auth/actions'
import type { ReactNode } from 'react'

export async function AccountSettings({ children }: { children?: ReactNode }) {
  const [profile, user, creator] = await Promise.all([getMyProfile(), getCurrentUser(), getMyCreator()])

  return (
    <section id="conta" aria-label="Dados da conta e canais" className="scroll-mt-8 mb-6">
      <div>
        <div className="flex flex-wrap items-end gap-6">
        {creator && <ProfileImage src={creator.avatar_url} name={creator.name} />}
        <dl className="grid min-w-0 flex-1 gap-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-fg-muted">Nome da conta</dt>
            <dd className="mt-1.5 break-words">{profile?.display_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Email de acesso</dt>
            <dd className="mt-1.5 break-all">{profile?.email || user?.email || '—'}</dd>
          </div>
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
