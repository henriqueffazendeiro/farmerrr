import type { ReactNode } from 'react'
import { Mail } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DiscordIcon, TikTokIcon } from '@/components/ui/discord-icon'
import { clipperSignOutAction } from '@/lib/clippers/actions'
import { getClipperMembership } from '@/lib/clippers/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClipperPrizesView, prizeNotices } from '@/components/prizes/clipper-prizes'
import { prizesConfigured } from '@/lib/prizes/payments'
import { clipperPrizes, payoutAccount, type ClipperPrize } from '@/lib/prizes/payouts'
import type { ClipperPayoutAccount } from '@/lib/db/types'
import { ClipperContactForm } from './discord-field'

export type ClipperSettingsData = {
  slug: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  discord: string | null
  email: string | null
  /** A ligação ao TikTok precisa de nova autorização. */
  needsReauth: boolean
  /** null: pagamentos de prémios desligados. */
  prizes: ClipperPrize[] | null
  payoutAccount: Pick<ClipperPayoutAccount, 'transfers_enabled' | 'details_submitted'> | null
  /** Banido pelo streamer nesta competição (com o motivo, se houver). */
  banned: { reason: string | null } | null
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-6">
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
      <div className="flex flex-wrap items-center gap-6">
        <Avatar src={data.avatarUrl} name={data.displayName} size="lg" className="rounded-sm border-0" />
        <dl className="min-w-0 flex-1 space-y-1 text-sm">
          <dt className="sr-only">TikTok</dt>
          <dd className="flex items-center gap-1.5 break-all"><TikTokIcon className="shrink-0" />{data.username ? `@${data.username}` : data.displayName}</dd>
          {/* Discord por baixo do TikTok (só quando está preenchido). */}
          {data.discord && <>
            <dt className="sr-only">Discord</dt>
            <dd className="flex items-center gap-1.5 break-all"><DiscordIcon className="shrink-0 text-[#5865f2]" />{data.discord}</dd>
          </>}
          {/* Email por baixo do Discord (só quando está preenchido; só o próprio clipper o vê). */}
          {data.email && <>
            <dt className="sr-only">Email</dt>
            <dd className="flex items-center gap-1.5 break-all text-fg-muted"><Mail className="h-[13px] w-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />{data.email}</dd>
          </>}
        </dl>
      </div>
      {data.needsReauth && <p className="mt-4 text-sm text-gold">
        A ligação ao TikTok expirou.{' '}
        <a href={preview ? undefined : `/api/auth/tiktok/start?lb=${encodeURIComponent(data.slug)}`} className="underline underline-offset-4">Autorizar novamente</a>
      </p>}
    </section>

    <ClipperContactForm slug={data.slug} discord={data.discord} email={data.email} preview={preview} />

    {data.prizes && <Section title="Ganhos">
      {premios && prizeNotices[premios] && <p role="status" className="mb-2 text-sm">{prizeNotices[premios]}</p>}
      <ClipperPrizesView prizes={data.prizes} account={data.payoutAccount} slug={data.slug} preview={preview} />
    </Section>}

    <section aria-label="Sessão" className="mt-6">
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
    createAdminClient().from('clipper_profiles').select('display_name,avatar_url,discord,email').eq('id', profileId).maybeSingle(),
    createAdminClient().from('social_accounts').select('avatar_url').eq('clipper_profile_id', profileId).eq('provider', 'tiktok').maybeSingle(),
    prizesConfigured()
      ? Promise.all([clipperPrizes(profileId, participant.id), payoutAccount(profileId)]).catch(() => [null, null] as const)
      : Promise.resolve([null, null] as const),
  ])
  return {
    slug, username: account?.username ?? null,
    displayName: profile?.display_name ?? account?.display_name ?? 'Clipper',
    avatarUrl: profile?.avatar_url ?? social?.avatar_url ?? null,
    discord: profile?.discord ?? null,
    email: profile?.email ?? null,
    needsReauth: !!account && account.status !== 'connected',
    prizes, payoutAccount: payout,
    banned: participant.status === 'disqualified' ? { reason: participant.ban_reason ?? null } : null,
  }
}
