import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { clipperSignOutAction } from '@/lib/clippers/actions'
import { getClipperMembership } from '@/lib/clippers/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClipperPrizesView, prizeNotices } from '@/components/prizes/clipper-prizes'
import { prizesConfigured } from '@/lib/prizes/payments'
import { clipperPrizes, payoutAccount, type ClipperPrize } from '@/lib/prizes/payouts'
import type { ClipperPayoutAccount } from '@/lib/db/types'
import { DiscordField } from './discord-field'

export type ClipperSettingsData = {
  slug: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  discord: string | null
  /** A ligação ao TikTok precisa de nova autorização. */
  needsReauth: boolean
  /** null: pagamentos de prémios desligados. */
  prizes: ClipperPrize[] | null
  payoutAccount: Pick<ClipperPayoutAccount, 'transfers_enabled' | 'details_submitted'> | null
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-6 pt-6">
    <h3 className="mb-1.5 text-xs text-fg-muted">{title}</h3>
    {children}
  </section>
}

/**
 * As definições do clipper, com a mesma estrutura das do streamer: foto e TikTok, Discord, ganhos com "Levantar"
 * e "Terminar sessão". Usadas no painel lateral da página do streamer e na página /join/…/conta.
 */
export function ClipperSettingsView({ data, premios, preview = false }: { data: ClipperSettingsData; premios?: string; preview?: boolean }) {
  return <div>
    <section aria-label="Conta" className="mb-6">
      <div className="flex flex-wrap items-end gap-6">
        <Avatar src={data.avatarUrl} name={data.displayName} size="lg" className="rounded-sm border-0" />
        <dl className="min-w-0 flex-1 text-sm">
          <dt className="text-xs text-fg-muted">TikTok</dt>
          <dd className="mt-1.5 break-words">{data.username ? `@${data.username}` : data.displayName}</dd>
        </dl>
      </div>
      {data.needsReauth && <p className="mt-4 text-sm text-gold">
        A ligação ao TikTok expirou.{' '}
        <a href={preview ? undefined : `/api/auth/tiktok/start?lb=${encodeURIComponent(data.slug)}`} className="underline underline-offset-4">Autorizar novamente</a>
      </p>}
    </section>

    <DiscordField slug={data.slug} value={data.discord} preview={preview} />

    {data.prizes && <Section title="Ganhos">
      {premios && prizeNotices[premios] && <p role="status" className="mb-2 text-sm">{prizeNotices[premios]}</p>}
      <ClipperPrizesView prizes={data.prizes} account={data.payoutAccount} slug={data.slug} preview={preview} />
    </Section>}

    <section aria-label="Sessão" className="mt-6 pt-6">
      <form action={preview ? undefined : clipperSignOutAction}>
        <input type="hidden" name="slug" value={data.slug} />
        <Button type={preview ? 'button' : 'submit'} variant="danger" className="w-full border-0 bg-danger/10 hover:bg-danger/20">Terminar sessão</Button>
      </form>
    </section>
  </div>
}

/** Dados do clipper com sessão nesta competição; null se não participa. */
export async function clipperSettingsData(slug: string): Promise<ClipperSettingsData | null> {
  const member = await getClipperMembership(slug)
  if (!member) return null
  const { participant, account } = member
  const profileId = participant.clipper_profile_id
  const [{ data: profile }, { data: social }, [prizes, payout]] = await Promise.all([
    createAdminClient().from('clipper_profiles').select('display_name,avatar_url,discord').eq('id', profileId).maybeSingle(),
    createAdminClient().from('social_accounts').select('avatar_url').eq('clipper_profile_id', profileId).eq('provider', 'tiktok').maybeSingle(),
    prizesConfigured()
      ? Promise.all([clipperPrizes(profileId), payoutAccount(profileId)]).catch(() => [null, null] as const)
      : Promise.resolve([null, null] as const),
  ])
  return {
    slug, username: account?.username ?? null,
    displayName: profile?.display_name ?? account?.display_name ?? 'Clipper',
    avatarUrl: profile?.avatar_url ?? social?.avatar_url ?? null,
    discord: profile?.discord ?? null,
    needsReauth: !!account && account.status !== 'connected',
    prizes, payoutAccount: payout,
  }
}
